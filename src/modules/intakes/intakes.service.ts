import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import {
  EDITABLE_INTAKE_STATUSES,
  IntakeStatus,
} from '../../common/enums/intake-status.enum.js';
import { IntakeEntity } from '../../database/entities/intake.entity.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import type {
  ApplicationWindowDto,
  CreateIntakeDto,
  UpdateIntakeDto,
} from './dto/intake-request.dto.js';
import type { ListIntakesQueryDto } from './dto/list-intakes-query.dto.js';
import type {
  IntakeListResponseDto,
  IntakeResponseDto,
  IntakeStatusSummaryDto,
} from './dto/intake-response.dto.js';

@Injectable()
export class IntakesService {
  constructor(
    @InjectRepository(IntakeEntity)
    private readonly intakesRepo: Repository<IntakeEntity>,
    @InjectRepository(ProgrammeOfferingEntity)
    private readonly offeringsRepo: Repository<ProgrammeOfferingEntity>,
  ) {}

  async create(
    ctx: RequestContext,
    dto: CreateIntakeDto,
  ): Promise<IntakeResponseDto> {
    this.assertValidWindow(dto.applicationOpenAt, dto.applicationCloseAt);
    await this.assertUniqueCode(ctx.tenantId, dto.intakeCode);

    const entity = this.intakesRepo.create({
      tenantId: ctx.tenantId,
      intakeName: dto.intakeName,
      intakeCode: dto.intakeCode,
      status: IntakeStatus.DRAFT,
      applicationOpenAt: dto.applicationOpenAt,
      applicationCloseAt: dto.applicationCloseAt,
      offerPaymentPeriodDays: dto.offerPaymentPeriodDays ?? 5,
      meritGenerationMode: dto.meritGenerationMode ?? 'MANUAL',
      feeConfirmMarginPercent: String(dto.feeConfirmMarginPercent ?? 0),
      offerFeeGraceHours: dto.offerFeeGraceHours ?? 0,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    const saved = await this.intakesRepo.save(entity);
    return this.toResponse(saved, 0);
  }

  async list(
    ctx: RequestContext,
    query: ListIntakesQueryDto,
  ): Promise<IntakeListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.intakesRepo
      .createQueryBuilder('intake')
      .where('intake.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .orderBy('intake.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('intake.status = :status', { status: query.status });
    }

    const [rows, total] = await qb.getManyAndCount();
    const programmesCounts = await this.getProgrammesCounts(
      ctx.tenantId,
      rows.map((row) => row.id),
    );

    return {
      items: rows.map((row) =>
        this.toResponse(row, programmesCounts.get(String(row.id)) ?? 0),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getStats(ctx: RequestContext): Promise<IntakeStatusSummaryDto> {
    return this.getStatusSummary(ctx.tenantId);
  }

  private async getStatusSummary(
    tenantId: string,
  ): Promise<IntakeStatusSummaryDto> {
    const rows = await this.intakesRepo
      .createQueryBuilder('intake')
      .select('intake.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('intake.tenantId = :tenantId', { tenantId })
      .groupBy('intake.status')
      .getRawMany<{ status: string; count: string }>();

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const n = Number(row.count) || 0;
      counts[row.status] = n;
      total += n;
    }

    return {
      total,
      draft: counts[IntakeStatus.DRAFT] ?? 0,
      configured: counts[IntakeStatus.CONFIGURED] ?? 0,
      underReview: counts[IntakeStatus.UNDER_REVIEW] ?? 0,
      published: counts[IntakeStatus.PUBLISHED] ?? 0,
      closed: counts[IntakeStatus.CLOSED] ?? 0,
    };
  }

  private async getProgrammesCounts(
    tenantId: string,
    intakeIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (intakeIds.length === 0) return map;

    const rows = await this.offeringsRepo
      .createQueryBuilder('offering')
      .select('offering.intakeId', 'intakeId')
      .addSelect('COUNT(DISTINCT offering.programmeId)', 'count')
      .where('offering.tenantId = :tenantId', { tenantId })
      .andWhere('offering.intakeId IN (:...intakeIds)', { intakeIds })
      .groupBy('offering.intakeId')
      .getRawMany<{ intakeId: string; count: string }>();

    for (const row of rows) {
      map.set(String(row.intakeId), Number(row.count) || 0);
    }
    return map;
  }

  async getById(
    ctx: RequestContext,
    intakeId: string,
  ): Promise<IntakeResponseDto> {
    const intake = await this.findTenantIntake(ctx.tenantId, intakeId);
    const programmesCounts = await this.getProgrammesCounts(ctx.tenantId, [
      intake.id,
    ]);
    return this.toResponse(
      intake,
      programmesCounts.get(String(intake.id)) ?? 0,
    );
  }

  async update(
    ctx: RequestContext,
    intakeId: string,
    dto: UpdateIntakeDto,
  ): Promise<IntakeResponseDto> {
    if (
      !dto.intakeName &&
      !dto.intakeCode &&
      dto.offerPaymentPeriodDays === undefined &&
      dto.meritGenerationMode === undefined &&
      dto.feeConfirmMarginPercent === undefined &&
      dto.offerFeeGraceHours === undefined
    ) {
      throw new BusinessException(
        'At least one intake field is required',
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
      );
    }

    const intake = await this.findTenantIntake(ctx.tenantId, intakeId);
    this.assertEditable(intake);

    if (dto.intakeCode && dto.intakeCode !== intake.intakeCode) {
      await this.assertUniqueCode(ctx.tenantId, dto.intakeCode, intake.id);
      intake.intakeCode = dto.intakeCode;
    }
    if (dto.intakeName) {
      intake.intakeName = dto.intakeName;
    }
    if (dto.offerPaymentPeriodDays !== undefined) intake.offerPaymentPeriodDays = dto.offerPaymentPeriodDays;
    if (dto.meritGenerationMode !== undefined) intake.meritGenerationMode = dto.meritGenerationMode;
    if (dto.feeConfirmMarginPercent !== undefined) {
      intake.feeConfirmMarginPercent = String(dto.feeConfirmMarginPercent);
    }
    if (dto.offerFeeGraceHours !== undefined) intake.offerFeeGraceHours = dto.offerFeeGraceHours;

    intake.updatedBy = ctx.userId;
    const saved = await this.intakesRepo.save(intake);
    const programmesCounts = await this.getProgrammesCounts(ctx.tenantId, [
      saved.id,
    ]);
    return this.toResponse(
      saved,
      programmesCounts.get(String(saved.id)) ?? 0,
    );
  }

  async updateApplicationWindow(
    ctx: RequestContext,
    intakeId: string,
    dto: ApplicationWindowDto,
  ): Promise<IntakeResponseDto> {
    const intake = await this.findTenantIntake(ctx.tenantId, intakeId);
    this.assertEditable(intake);
    this.assertValidWindow(dto.applicationOpenAt, dto.applicationCloseAt);

    intake.applicationOpenAt = dto.applicationOpenAt;
    intake.applicationCloseAt = dto.applicationCloseAt;
    intake.updatedBy = ctx.userId;

    const saved = await this.intakesRepo.save(intake);
    const programmesCounts = await this.getProgrammesCounts(ctx.tenantId, [
      saved.id,
    ]);
    return this.toResponse(
      saved,
      programmesCounts.get(String(saved.id)) ?? 0,
    );
  }

  async findTenantIntake(
    tenantId: string,
    intakeId: string,
  ): Promise<IntakeEntity> {
    const intake = await this.intakesRepo.findOne({
      where: { id: intakeId, tenantId },
    });
    if (!intake) {
      throw new NotFoundException(`Intake ${intakeId} was not found`);
    }
    return intake;
  }

  /**
   * Moves DRAFT → CONFIGURED once configuration work starts
   * (first offering / criteria / fees / supporting information).
   */
  async markConfiguredIfDraft(
    tenantId: string,
    intakeId: string,
    userId: string,
  ): Promise<IntakeEntity> {
    const intake = await this.findTenantIntake(tenantId, intakeId);
    if (intake.status === IntakeStatus.DRAFT) {
      intake.status = IntakeStatus.CONFIGURED;
      intake.updatedBy = userId;
      return this.intakesRepo.save(intake);
    }
    return intake;
  }

  private async assertUniqueCode(
    tenantId: string,
    intakeCode: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.intakesRepo.findOne({
      where: { tenantId, intakeCode: intakeCode.trim() },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Intake code '${intakeCode}' already exists for this tenant`,
      );
    }
  }

  private assertEditable(intake: IntakeEntity): void {
    if (!EDITABLE_INTAKE_STATUSES.includes(intake.status as IntakeStatus)) {
      throw new ForbiddenException(
        `Intake in status ${intake.status} cannot be modified`,
      );
    }
  }

  private assertValidWindow(openAt: Date, closeAt: Date): void {
    if (!(openAt instanceof Date) || Number.isNaN(openAt.getTime())) {
      throw new BusinessException('applicationOpenAt must be a valid datetime');
    }
    if (!(closeAt instanceof Date) || Number.isNaN(closeAt.getTime())) {
      throw new BusinessException('applicationCloseAt must be a valid datetime');
    }
    if (closeAt.getTime() <= openAt.getTime()) {
      throw new BusinessException(
        'applicationCloseAt must be after applicationOpenAt',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_APPLICATION_WINDOW',
      );
    }
  }

  toResponse(entity: IntakeEntity, programmesCount = 0): IntakeResponseDto {
    return {
      id: String(entity.id),
      tenantId: String(entity.tenantId),
      intakeName: entity.intakeName,
      intakeCode: entity.intakeCode,
      status: entity.status as IntakeStatus,
      applicationOpenAt: entity.applicationOpenAt.toISOString(),
      applicationCloseAt: entity.applicationCloseAt.toISOString(),
      offerPaymentPeriodDays: entity.offerPaymentPeriodDays,
      meritGenerationMode: entity.meritGenerationMode ?? 'MANUAL',
      feeConfirmMarginPercent: Number(entity.feeConfirmMarginPercent ?? 0),
      offerFeeGraceHours: entity.offerFeeGraceHours ?? 0,
      publishedAt: entity.publishedAt
        ? entity.publishedAt.toISOString()
        : null,
      publishedBy: entity.publishedBy ? String(entity.publishedBy) : null,
      programmesCount,
      createdAt: entity.createdAt.toISOString(),
      createdBy: String(entity.createdBy),
      updatedAt: entity.updatedAt.toISOString(),
      updatedBy: String(entity.updatedBy),
    };
  }
}
