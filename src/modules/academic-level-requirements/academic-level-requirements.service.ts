import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import { AcademicDegreeType } from '../../common/enums/application-completion.enum.js';
import { DegreeLevel } from '../../common/enums/master-data.enum.js';
import { AcademicLevelRequirementEntity } from '../../database/entities/academic-level-requirement.entity.js';
import type {
  AcademicLevelRequirementListResponseDto,
  AcademicLevelRequirementResponseDto,
  CreateAcademicLevelRequirementDto,
  ListAcademicLevelRequirementsQueryDto,
  UpdateAcademicLevelRequirementDto,
} from './dto/academic-level-requirement.dto.js';

@Injectable()
export class AcademicLevelRequirementsService {
  constructor(
    @InjectRepository(AcademicLevelRequirementEntity)
    private readonly repo: Repository<AcademicLevelRequirementEntity>,
  ) {}

  async create(
    ctx: RequestContext,
    dto: CreateAcademicLevelRequirementDto,
  ): Promise<AcademicLevelRequirementResponseDto> {
    await this.assertUnique(
      ctx.tenantId,
      dto.degreeLevel,
      dto.requiredAcademicCode,
    );

    const entity = this.repo.create({
      tenantId: ctx.tenantId,
      degreeLevel: dto.degreeLevel,
      requiredAcademicCode: dto.requiredAcademicCode,
      mandatory: dto.mandatory ?? true,
      sortOrder: dto.sortOrder ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    return this.toResponse(await this.repo.save(entity));
  }

  async list(
    ctx: RequestContext,
    query: ListAcademicLevelRequirementsQueryDto,
  ): Promise<AcademicLevelRequirementListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: {
      tenantId: string;
      degreeLevel?: string;
    } = { tenantId: ctx.tenantId };
    if (query.degreeLevel) where.degreeLevel = query.degreeLevel;

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { degreeLevel: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((r) => this.toResponse(r)),
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
    id: string,
  ): Promise<AcademicLevelRequirementResponseDto> {
    return this.toResponse(await this.findTenant(ctx.tenantId, id));
  }

  async update(
    ctx: RequestContext,
    id: string,
    dto: UpdateAcademicLevelRequirementDto,
  ): Promise<AcademicLevelRequirementResponseDto> {
    const entity = await this.findTenant(ctx.tenantId, id);
    const nextLevel = dto.degreeLevel ?? (entity.degreeLevel as DegreeLevel);
    const nextCode =
      dto.requiredAcademicCode ??
      (entity.requiredAcademicCode as AcademicDegreeType);

    if (
      nextLevel !== entity.degreeLevel ||
      nextCode !== entity.requiredAcademicCode
    ) {
      await this.assertUnique(ctx.tenantId, nextLevel, nextCode, id);
    }

    if (dto.degreeLevel !== undefined) entity.degreeLevel = dto.degreeLevel;
    if (dto.requiredAcademicCode !== undefined) {
      entity.requiredAcademicCode = dto.requiredAcademicCode;
    }
    if (dto.mandatory !== undefined) entity.mandatory = dto.mandatory;
    if (dto.sortOrder !== undefined) entity.sortOrder = dto.sortOrder;
    entity.updatedBy = ctx.userId;

    return this.toResponse(await this.repo.save(entity));
  }

  async remove(
    ctx: RequestContext,
    id: string,
  ): Promise<AcademicLevelRequirementResponseDto> {
    const entity = await this.findTenant(ctx.tenantId, id);
    await this.repo.remove(entity);
    return this.toResponse(entity);
  }

  async listMandatoryCodesForDegreeLevels(
    tenantId: string,
    degreeLevels: string[],
  ): Promise<Map<string, AcademicDegreeType[]>> {
    const result = new Map<string, AcademicDegreeType[]>();
    if (!degreeLevels.length) return result;

    const uniqueLevels = [...new Set(degreeLevels)];
    const rows = await this.repo.find({
      where: {
        tenantId,
        degreeLevel: In(uniqueLevels),
        mandatory: true,
      },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    for (const row of rows) {
      const list = result.get(row.degreeLevel) ?? [];
      if (!list.includes(row.requiredAcademicCode as AcademicDegreeType)) {
        list.push(row.requiredAcademicCode as AcademicDegreeType);
      }
      result.set(row.degreeLevel, list);
    }
    return result;
  }

  private async findTenant(
    tenantId: string,
    id: string,
  ): Promise<AcademicLevelRequirementEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId } });
    if (!entity) {
      throw new NotFoundException(
        `Academic level requirement ${id} was not found`,
      );
    }
    return entity;
  }

  private async assertUnique(
    tenantId: string,
    degreeLevel: DegreeLevel,
    requiredAcademicCode: AcademicDegreeType,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { tenantId, degreeLevel, requiredAcademicCode },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Requirement ${requiredAcademicCode} for ${degreeLevel} already exists`,
      );
    }
  }

  private toResponse(
    entity: AcademicLevelRequirementEntity,
  ): AcademicLevelRequirementResponseDto {
    return {
      id: String(entity.id),
      tenantId: String(entity.tenantId),
      degreeLevel: entity.degreeLevel as DegreeLevel,
      requiredAcademicCode:
        entity.requiredAcademicCode as AcademicDegreeType,
      mandatory: entity.mandatory,
      sortOrder: entity.sortOrder,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
