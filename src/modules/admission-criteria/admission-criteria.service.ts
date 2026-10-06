import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import { CriteriaOperator } from '../../common/enums/criteria-operator.enum.js';
import { AcademicDegreeType } from '../../common/enums/application-completion.enum.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { AdmissionCriterionEntity } from '../../database/entities/admission-criterion.entity.js';
import { CriteriaTypeEntity } from '../../database/entities/criteria-type.entity.js';
import { GeneralCriterionEntity } from '../../database/entities/general-criterion.entity.js';
import { ProgrammeOfferingsService } from '../programme-offerings/programme-offerings.service.js';
import type {
  AdmissionCriterionBatchResponseDto,
  AdmissionCriterionResponseDto,
  CreateAdmissionCriterionDto,
  CreateAdmissionCriterionItemDto,
  UpdateAdmissionCriterionDto,
} from './dto/admission-criterion.dto.js';

@Injectable()
export class AdmissionCriteriaService {
  constructor(
    @InjectRepository(AdmissionCriterionEntity)
    private readonly admissionCriteriaRepo: Repository<AdmissionCriterionEntity>,
    @InjectRepository(GeneralCriterionEntity)
    private readonly generalCriteriaRepo: Repository<GeneralCriterionEntity>,
    @InjectRepository(CriteriaTypeEntity)
    private readonly criteriaTypesRepo: Repository<CriteriaTypeEntity>,
    private readonly programmeOfferingsService: ProgrammeOfferingsService,
    private readonly dataSource: DataSource,
  ) {}

  async createForOfferings(
    ctx: RequestContext,
    dto: CreateAdmissionCriterionDto,
  ): Promise<AdmissionCriterionBatchResponseDto> {
    for (const item of dto.criteria) {
      this.assertEffectiveWindow(
        item.effectiveFrom ?? null,
        item.effectiveTo ?? null,
      );
    }

    for (const offeringId of dto.offeringIds) {
      await this.programmeOfferingsService.ensureEditableOffering(
        ctx.tenantId,
        offeringId,
      );
    }

    const responses: AdmissionCriterionResponseDto[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const item of dto.criteria) {
        const general = await this.resolveGeneralCriterion(
          manager,
          ctx,
          item,
        );

        for (const offeringId of dto.offeringIds) {
          const criterion = manager.create(AdmissionCriterionEntity, {
            tenantId: ctx.tenantId,
            programmeOfferingId: offeringId,
            generalCriteriaId: general.id,
            sequenceNo: item.sequenceNo ?? null,
            effectiveFrom: item.effectiveFrom ?? null,
            effectiveTo: item.effectiveTo ?? null,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          });
          const savedCriterion = await manager.save(criterion);
          responses.push(this.toResponse(savedCriterion, general));
        }
      }
    });

    for (const offeringId of dto.offeringIds) {
      await this.programmeOfferingsService.markConfiguredForSetup(
        ctx.tenantId,
        offeringId,
        ctx.userId,
      );
    }

    return { items: responses };
  }

  async listByOffering(
    ctx: RequestContext,
    offeringId: string,
  ): Promise<AdmissionCriterionBatchResponseDto> {
    await this.programmeOfferingsService.findTenantOffering(
      ctx.tenantId,
      offeringId,
    );

    const criteria = await this.admissionCriteriaRepo.find({
      where: {
        tenantId: ctx.tenantId,
        programmeOfferingId: offeringId,
      },
      order: { sequenceNo: 'ASC', createdAt: 'ASC' },
    });

    const items: AdmissionCriterionResponseDto[] = [];
    for (const criterion of criteria) {
      const general = await this.generalCriteriaRepo.findOne({
        where: { id: criterion.generalCriteriaId, tenantId: ctx.tenantId },
      });
      if (!general) {
        throw new NotFoundException(
          `General criteria ${criterion.generalCriteriaId} was not found`,
        );
      }
      items.push(this.toResponse(criterion, general));
    }

    return { items };
  }

  private async resolveGeneralCriterion(
    manager: import('typeorm').EntityManager,
    ctx: RequestContext,
    item: CreateAdmissionCriterionItemDto,
  ): Promise<GeneralCriterionEntity> {
    if (item.generalCriteriaId) {
      const existing = await manager.findOne(GeneralCriterionEntity, {
        where: { id: item.generalCriteriaId, tenantId: ctx.tenantId },
      });
      if (!existing) {
        throw new NotFoundException(
          `General criteria ${item.generalCriteriaId} was not found`,
        );
      }
      return existing;
    }

    await this.assertActiveCriteriaType(item.criteriaTypeId!);
    const general = manager.create(GeneralCriterionEntity, {
      tenantId: ctx.tenantId,
      criteriaTypeId: item.criteriaTypeId!,
      criteriaName: item.criteriaName ?? null,
      criteriaRequirement: item.criteriaRequirement!,
      criteriaOperator: item.criteriaOperator ?? null,
      criteriaUnit: item.criteriaUnit ?? null,
      criteriaValue:
        item.criteriaValue === undefined || item.criteriaValue === null
          ? null
          : String(item.criteriaValue),
      criteriaValueMax:
        item.criteriaValueMax === undefined || item.criteriaValueMax === null
          ? null
          : String(item.criteriaValueMax),
      appliesToDegreeType: item.appliesToDegreeType ?? null,
      mandatory: item.mandatory ?? true,
    });
    this.assertStructuredValues(general);
    return manager.save(general);
  }

  async update(
    ctx: RequestContext,
    criteriaId: string,
    dto: UpdateAdmissionCriterionDto,
  ): Promise<AdmissionCriterionResponseDto> {
    const criterion = await this.findTenantCriterion(ctx.tenantId, criteriaId);
    await this.programmeOfferingsService.ensureEditableOffering(
      ctx.tenantId,
      criterion.programmeOfferingId,
    );

    const general = await this.generalCriteriaRepo.findOne({
      where: { id: criterion.generalCriteriaId, tenantId: ctx.tenantId },
    });
    if (!general) {
      throw new NotFoundException(
        `General criteria ${criterion.generalCriteriaId} was not found`,
      );
    }

    const nextFrom =
      dto.effectiveFrom !== undefined ? dto.effectiveFrom : criterion.effectiveFrom;
    const nextTo =
      dto.effectiveTo !== undefined ? dto.effectiveTo : criterion.effectiveTo;
    this.assertEffectiveWindow(nextFrom, nextTo);

    if (dto.criteriaName !== undefined) general.criteriaName = dto.criteriaName;
    if (dto.criteriaRequirement !== undefined) {
      general.criteriaRequirement = dto.criteriaRequirement;
    }
    if (dto.criteriaOperator !== undefined) {
      general.criteriaOperator = dto.criteriaOperator;
    }
    if (dto.criteriaUnit !== undefined) general.criteriaUnit = dto.criteriaUnit;
    if (dto.criteriaValue !== undefined) {
      general.criteriaValue =
        dto.criteriaValue === null ? null : String(dto.criteriaValue);
    }
    if (dto.criteriaValueMax !== undefined) {
      general.criteriaValueMax =
        dto.criteriaValueMax === null ? null : String(dto.criteriaValueMax);
    }
    if (dto.appliesToDegreeType !== undefined) {
      general.appliesToDegreeType = dto.appliesToDegreeType;
    }
    if (dto.mandatory !== undefined) general.mandatory = dto.mandatory;

    this.assertStructuredValues(general);

    if (dto.sequenceNo !== undefined) criterion.sequenceNo = dto.sequenceNo;
    if (dto.effectiveFrom !== undefined) {
      criterion.effectiveFrom = dto.effectiveFrom;
    }
    if (dto.effectiveTo !== undefined) criterion.effectiveTo = dto.effectiveTo;
    criterion.updatedBy = ctx.userId;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(general);
      await manager.save(criterion);
    });

    return this.toResponse(criterion, general);
  }

  private async findTenantCriterion(
    tenantId: string,
    criteriaId: string,
  ): Promise<AdmissionCriterionEntity> {
    const criterion = await this.admissionCriteriaRepo.findOne({
      where: { id: criteriaId, tenantId },
    });
    if (!criterion) {
      throw new NotFoundException(`Admission criterion ${criteriaId} was not found`);
    }
    return criterion;
  }

  private async assertActiveCriteriaType(criteriaTypeId: string): Promise<void> {
    const type = await this.criteriaTypesRepo.findOne({
      where: { id: criteriaTypeId },
    });
    if (!type) {
      throw new NotFoundException(`Criteria type ${criteriaTypeId} was not found`);
    }
    if (type.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Criteria type ${criteriaTypeId} is not ACTIVE`,
      );
    }
  }

  private assertEffectiveWindow(
    effectiveFrom: Date | null,
    effectiveTo: Date | null,
  ): void {
    if (effectiveFrom && effectiveTo && effectiveTo.getTime() <= effectiveFrom.getTime()) {
      throw new BusinessException(
        'effectiveTo must be after effectiveFrom',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_EFFECTIVE_WINDOW',
      );
    }
  }

  private assertStructuredValues(entity: GeneralCriterionEntity): void {
    const min = entity.criteriaValue != null ? Number(entity.criteriaValue) : null;
    const max =
      entity.criteriaValueMax != null ? Number(entity.criteriaValueMax) : null;
    if (min != null && max != null && max < min) {
      throw new BusinessException(
        'criteriaValueMax must be greater than or equal to criteriaValue',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_CRITERIA_VALUE_RANGE',
      );
    }
    if (
      entity.criteriaOperator === CriteriaOperator.BETWEEN &&
      (min == null || max == null)
    ) {
      throw new BusinessException(
        'criteriaValue and criteriaValueMax are required when criteriaOperator is BETWEEN',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_CRITERIA_BETWEEN',
      );
    }
  }

  private toResponse(
    criterion: AdmissionCriterionEntity,
    general: GeneralCriterionEntity,
  ): AdmissionCriterionResponseDto {
    return {
      id: String(criterion.id),
      tenantId: String(criterion.tenantId),
      programmeOfferingId: String(criterion.programmeOfferingId),
      generalCriteriaId: String(criterion.generalCriteriaId),
      criteriaTypeId: String(general.criteriaTypeId),
      criteriaName: general.criteriaName,
      criteriaRequirement: general.criteriaRequirement,
      criteriaOperator: (general.criteriaOperator as CriteriaOperator | null) ?? null,
      criteriaUnit: general.criteriaUnit,
      criteriaValue:
        general.criteriaValue != null ? Number(general.criteriaValue) : null,
      criteriaValueMax:
        general.criteriaValueMax != null
          ? Number(general.criteriaValueMax)
          : null,
      appliesToDegreeType:
        (general.appliesToDegreeType as AcademicDegreeType | null) ?? null,
      mandatory: general.mandatory,
      sequenceNo: criterion.sequenceNo,
      effectiveFrom: criterion.effectiveFrom
        ? criterion.effectiveFrom.toISOString()
        : null,
      effectiveTo: criterion.effectiveTo
        ? criterion.effectiveTo.toISOString()
        : null,
      createdAt: criterion.createdAt.toISOString(),
      createdBy: String(criterion.createdBy),
      updatedAt: criterion.updatedAt.toISOString(),
      updatedBy: String(criterion.updatedBy),
    };
  }
}
