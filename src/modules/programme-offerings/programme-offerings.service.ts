import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import {
  EDITABLE_INTAKE_STATUSES,
  IntakeStatus,
} from '../../common/enums/intake-status.enum.js';
import {
  EDITABLE_OFFERING_STATUSES,
  OfferingStatus,
} from '../../common/enums/offering-status.enum.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import { ProgrammeEntity } from '../../database/entities/programme.entity.js';
import { IntakesService } from '../intakes/intakes.service.js';
import type {
  CreateOfferingDto,
  ListOfferingsQueryDto,
  OfferingListResponseDto,
  OfferingResponseDto,
  UpdateOfferingDto,
} from './dto/offering.dto.js';

@Injectable()
export class ProgrammeOfferingsService {
  constructor(
    @InjectRepository(ProgrammeOfferingEntity)
    private readonly offeringsRepo: Repository<ProgrammeOfferingEntity>,
    @InjectRepository(ProgrammeEntity)
    private readonly programmesRepo: Repository<ProgrammeEntity>,
    private readonly intakesService: IntakesService,
  ) {}

  async createForIntake(
    ctx: RequestContext,
    intakeId: string,
    dto: CreateOfferingDto,
  ): Promise<OfferingResponseDto> {
    const intake = await this.intakesService.findTenantIntake(
      ctx.tenantId,
      intakeId,
    );
    this.assertIntakeEditable(intake.status);
    await this.assertActiveProgramme(ctx.tenantId, dto.programmeId);
    await this.assertUniqueOffering(ctx.tenantId, intakeId, dto.programmeId);

    const entity = this.offeringsRepo.create({
      tenantId: ctx.tenantId,
      intakeId,
      programmeId: dto.programmeId,
      offeringStatus: OfferingStatus.CONFIGURED,
      displayOrder: dto.displayOrder ?? null,
      seatCapacity: dto.seatCapacity ?? null,
      publishedDescription: dto.publishedDescription,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    const saved = await this.offeringsRepo.save(entity);
    await this.intakesService.markConfiguredIfDraft(
      ctx.tenantId,
      intakeId,
      ctx.userId,
    );
    return this.toResponse(saved);
  }

  async listForIntake(
    ctx: RequestContext,
    intakeId: string,
    query: ListOfferingsQueryDto,
  ): Promise<OfferingListResponseDto> {
    await this.intakesService.findTenantIntake(ctx.tenantId, intakeId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [rows, total] = await this.offeringsRepo.findAndCount({
      where: { tenantId: ctx.tenantId, intakeId },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
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

  async update(
    ctx: RequestContext,
    offeringId: string,
    dto: UpdateOfferingDto,
  ): Promise<OfferingResponseDto> {
    const offering = await this.findTenantOffering(ctx.tenantId, offeringId);
    this.assertOfferingEditable(offering.offeringStatus);

    const intake = await this.intakesService.findTenantIntake(
      ctx.tenantId,
      offering.intakeId,
    );
    this.assertIntakeEditable(intake.status);

    if (dto.publishedDescription !== undefined) {
      offering.publishedDescription = dto.publishedDescription;
    }
    if (dto.displayOrder !== undefined) {
      offering.displayOrder = dto.displayOrder;
    }
    if (dto.seatCapacity !== undefined) {
      offering.seatCapacity = dto.seatCapacity;
    }
    offering.updatedBy = ctx.userId;

    return this.toResponse(await this.offeringsRepo.save(offering));
  }

  async findTenantOffering(
    tenantId: string,
    offeringId: string,
  ): Promise<ProgrammeOfferingEntity> {
    const offering = await this.offeringsRepo.findOne({
      where: { id: offeringId, tenantId },
    });
    if (!offering) {
      throw new NotFoundException(`Offering ${offeringId} was not found`);
    }
    return offering;
  }

  /** Ensures offering exists and both offering + parent intake are editable. */
  async ensureEditableOffering(
    tenantId: string,
    offeringId: string,
  ): Promise<ProgrammeOfferingEntity> {
    const offering = await this.findTenantOffering(tenantId, offeringId);
    this.assertOfferingEditable(offering.offeringStatus);
    const intake = await this.intakesService.findTenantIntake(
      tenantId,
      offering.intakeId,
    );
    this.assertIntakeEditable(intake.status);
    return offering;
  }

  /**
   * Marks offering CONFIGURED when still DRAFT, and promotes parent intake
   * DRAFT → CONFIGURED.
   */
  async markConfiguredForSetup(
    tenantId: string,
    offeringId: string,
    userId: string,
  ): Promise<void> {
    const offering = await this.findTenantOffering(tenantId, offeringId);
    if (offering.offeringStatus === OfferingStatus.DRAFT) {
      offering.offeringStatus = OfferingStatus.CONFIGURED;
      offering.updatedBy = userId;
      await this.offeringsRepo.save(offering);
    }
    await this.intakesService.markConfiguredIfDraft(
      tenantId,
      offering.intakeId,
      userId,
    );
  }

  private async assertActiveProgramme(
    tenantId: string,
    programmeId: string,
  ): Promise<void> {
    const programme = await this.programmesRepo.findOne({
      where: { id: programmeId, tenantId },
    });
    if (!programme) {
      throw new NotFoundException(`Programme ${programmeId} was not found`);
    }
    if (programme.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Programme ${programmeId} is not ACTIVE and cannot be offered`,
      );
    }
  }

  private async assertUniqueOffering(
    tenantId: string,
    intakeId: string,
    programmeId: string,
  ): Promise<void> {
    const existing = await this.offeringsRepo.findOne({
      where: { tenantId, intakeId, programmeId },
    });
    if (existing) {
      throw new ConflictException(
        `Programme ${programmeId} is already offered in intake ${intakeId}`,
      );
    }
  }

  private assertIntakeEditable(status: string): void {
    if (!EDITABLE_INTAKE_STATUSES.includes(status as IntakeStatus)) {
      throw new ForbiddenException(
        `Intake in status ${status} cannot accept offering changes`,
      );
    }
  }

  private assertOfferingEditable(status: string): void {
    if (!EDITABLE_OFFERING_STATUSES.includes(status as OfferingStatus)) {
      throw new ForbiddenException(
        `Offering in status ${status} cannot be modified`,
      );
    }
  }

  private toResponse(entity: ProgrammeOfferingEntity): OfferingResponseDto {
    return {
      id: String(entity.id),
      tenantId: String(entity.tenantId),
      intakeId: String(entity.intakeId),
      programmeId: String(entity.programmeId),
      offeringStatus: entity.offeringStatus as OfferingStatus,
      displayOrder: entity.displayOrder,
      seatCapacity: entity.seatCapacity,
      publishedDescription: entity.publishedDescription,
      publishedAt: entity.publishedAt ? entity.publishedAt.toISOString() : null,
      createdAt: entity.createdAt.toISOString(),
      createdBy: String(entity.createdBy),
      updatedAt: entity.updatedAt.toISOString(),
      updatedBy: String(entity.updatedBy),
    };
  }
}
