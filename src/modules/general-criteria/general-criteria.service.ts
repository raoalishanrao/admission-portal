import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import { CriteriaOperator } from '../../common/enums/criteria-operator.enum.js';
import { AcademicDegreeType } from '../../common/enums/application-completion.enum.js';
import { AdmissionCriterionEntity } from '../../database/entities/admission-criterion.entity.js';
import { CriteriaTypeEntity } from '../../database/entities/criteria-type.entity.js';
import { GeneralCriterionEntity } from '../../database/entities/general-criterion.entity.js';
import type {
  CreateGeneralCriterionDto,
  GeneralCriterionListResponseDto,
  GeneralCriterionResponseDto,
  ListGeneralCriteriaQueryDto,
  UpdateGeneralCriterionDto,
} from './dto/general-criterion.dto.js';

@Injectable()
export class GeneralCriteriaService {
  constructor(
    @InjectRepository(GeneralCriterionEntity)
    private readonly generalCriteriaRepo: Repository<GeneralCriterionEntity>,
    @InjectRepository(CriteriaTypeEntity)
    private readonly criteriaTypesRepo: Repository<CriteriaTypeEntity>,
    @InjectRepository(AdmissionCriterionEntity)
    private readonly admissionCriteriaRepo: Repository<AdmissionCriterionEntity>,
  ) {}

  async create(
    ctx: RequestContext,
    dto: CreateGeneralCriterionDto,
  ): Promise<GeneralCriterionResponseDto> {
    await this.assertActiveCriteriaType(dto.criteriaTypeId);

    const entity = this.generalCriteriaRepo.create({
      tenantId: ctx.tenantId,
      criteriaTypeId: dto.criteriaTypeId,
      criteriaName: dto.criteriaName ?? null,
      criteriaRequirement: dto.criteriaRequirement,
      criteriaOperator: dto.criteriaOperator ?? null,
      criteriaUnit: dto.criteriaUnit ?? null,
      criteriaValue:
        dto.criteriaValue === undefined || dto.criteriaValue === null
          ? null
          : String(dto.criteriaValue),
      criteriaValueMax:
        dto.criteriaValueMax === undefined || dto.criteriaValueMax === null
          ? null
          : String(dto.criteriaValueMax),
      appliesToDegreeType: dto.appliesToDegreeType ?? null,
      mandatory: dto.mandatory ?? true,
    });

    this.assertStructuredValues(entity);

    return this.toResponse(await this.generalCriteriaRepo.save(entity));
  }

  async list(
    ctx: RequestContext,
    query: ListGeneralCriteriaQueryDto,
  ): Promise<GeneralCriterionListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: {
      tenantId: string;
      criteriaTypeId?: string;
    } = { tenantId: ctx.tenantId };
    if (query.criteriaTypeId) where.criteriaTypeId = query.criteriaTypeId;

    const [rows, total] = await this.generalCriteriaRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((row) => this.toResponse(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getById(
    ctx: RequestContext,
    generalCriteriaId: string,
  ): Promise<GeneralCriterionResponseDto> {
    return this.toResponse(
      await this.findTenantGeneralCriterion(ctx.tenantId, generalCriteriaId),
    );
  }

  async update(
    ctx: RequestContext,
    generalCriteriaId: string,
    dto: UpdateGeneralCriterionDto,
  ): Promise<GeneralCriterionResponseDto> {
    const entity = await this.findTenantGeneralCriterion(
      ctx.tenantId,
      generalCriteriaId,
    );

    if (dto.criteriaName !== undefined) entity.criteriaName = dto.criteriaName;
    if (dto.criteriaRequirement !== undefined) {
      entity.criteriaRequirement = dto.criteriaRequirement;
    }
    if (dto.criteriaOperator !== undefined) {
      entity.criteriaOperator = dto.criteriaOperator;
    }
    if (dto.criteriaUnit !== undefined) entity.criteriaUnit = dto.criteriaUnit;
    if (dto.criteriaValue !== undefined) {
      entity.criteriaValue =
        dto.criteriaValue === null ? null : String(dto.criteriaValue);
    }
    if (dto.criteriaValueMax !== undefined) {
      entity.criteriaValueMax =
        dto.criteriaValueMax === null ? null : String(dto.criteriaValueMax);
    }
    if (dto.appliesToDegreeType !== undefined) {
      entity.appliesToDegreeType = dto.appliesToDegreeType;
    }
    if (dto.mandatory !== undefined) entity.mandatory = dto.mandatory;

    this.assertStructuredValues(entity);

    return this.toResponse(await this.generalCriteriaRepo.save(entity));
  }

  async remove(
    ctx: RequestContext,
    generalCriteriaId: string,
  ): Promise<GeneralCriterionResponseDto> {
    const entity = await this.findTenantGeneralCriterion(
      ctx.tenantId,
      generalCriteriaId,
    );

    const inUse = await this.admissionCriteriaRepo.count({
      where: { generalCriteriaId, tenantId: ctx.tenantId },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `General criteria ${generalCriteriaId} is attached to ${inUse} offering criterion(s)`,
      );
    }

    await this.generalCriteriaRepo.remove(entity);
    return this.toResponse(entity);
  }

  async findTenantGeneralCriterion(
    tenantId: string,
    generalCriteriaId: string,
  ): Promise<GeneralCriterionEntity> {
    const entity = await this.generalCriteriaRepo.findOne({
      where: { id: generalCriteriaId, tenantId },
    });
    if (!entity) {
      throw new NotFoundException(
        `General criteria ${generalCriteriaId} was not found`,
      );
    }
    return entity;
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

  private assertStructuredValues(entity: GeneralCriterionEntity): void {
    const min = entity.criteriaValue != null ? Number(entity.criteriaValue) : null;
    const max =
      entity.criteriaValueMax != null ? Number(entity.criteriaValueMax) : null;
    if (min != null && max != null && max < min) {
      throw new ConflictException(
        'criteriaValueMax must be greater than or equal to criteriaValue',
      );
    }
    if (
      entity.criteriaOperator === CriteriaOperator.BETWEEN &&
      (min == null || max == null)
    ) {
      throw new ConflictException(
        'criteriaValue and criteriaValueMax are required when criteriaOperator is BETWEEN',
      );
    }
  }

  private toResponse(
    entity: GeneralCriterionEntity,
  ): GeneralCriterionResponseDto {
    return {
      id: String(entity.id),
      tenantId: String(entity.tenantId),
      criteriaTypeId: String(entity.criteriaTypeId),
      criteriaName: entity.criteriaName,
      criteriaRequirement: entity.criteriaRequirement,
      criteriaOperator:
        (entity.criteriaOperator as CriteriaOperator | null) ?? null,
      criteriaUnit: entity.criteriaUnit,
      criteriaValue:
        entity.criteriaValue != null ? Number(entity.criteriaValue) : null,
      criteriaValueMax:
        entity.criteriaValueMax != null
          ? Number(entity.criteriaValueMax)
          : null,
      appliesToDegreeType:
        (entity.appliesToDegreeType as AcademicDegreeType | null) ?? null,
      mandatory: entity.mandatory,
    };
  }
}
