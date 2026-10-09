import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import { DegreeLevel } from '../../common/enums/master-data.enum.js';
import {
  MeritFormulaStatus,
  MeritScoreSourceType,
} from '../../common/enums/merit-formula.enum.js';
import { MeritFormulaTemplateComponentEntity } from '../../database/entities/merit-formula-template-component.entity.js';
import { MeritFormulaTemplateEntity } from '../../database/entities/merit-formula-template.entity.js';
import { OfferingMeritFormulaComponentEntity } from '../../database/entities/offering-merit-formula-component.entity.js';
import { OfferingMeritFormulaEntity } from '../../database/entities/offering-merit-formula.entity.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import { ProgrammeEntity } from '../../database/entities/programme.entity.js';
import type {
  CreateMeritFormulaTemplateDto,
  ListMeritFormulaTemplatesQueryDto,
  MeritFormulaComponentInputDto,
  MeritFormulaComponentResponseDto,
  MeritFormulaTemplateListResponseDto,
  MeritFormulaTemplateResponseDto,
  OfferingMeritFormulaResponseDto,
  UpdateMeritFormulaTemplateDto,
  UpsertOfferingMeritFormulaDto,
} from './dto/merit-formula.dto.js';

export type MeritFormulaSnapshot = {
  degreeLevel: string;
  source: 'OFFERING' | 'TEMPLATE';
  templateId: string | null;
  offeringFormulaId: string | null;
  components: Array<{ sourceType: string; weight: number }>;
};

export type MeritScoreBreakdownItem = {
  sourceType: string;
  weight: number;
  rawPercentage: number | null;
  contribution: number;
  missing: boolean;
};

export type MeritScoreResult = {
  meritScore: number;
  breakdown: MeritScoreBreakdownItem[];
  incomplete: boolean;
};

@Injectable()
export class MeritFormulasService {
  constructor(
    @InjectRepository(MeritFormulaTemplateEntity)
    private readonly templatesRepo: Repository<MeritFormulaTemplateEntity>,
    @InjectRepository(MeritFormulaTemplateComponentEntity)
    private readonly templateComponentsRepo: Repository<MeritFormulaTemplateComponentEntity>,
    @InjectRepository(OfferingMeritFormulaEntity)
    private readonly offeringFormulasRepo: Repository<OfferingMeritFormulaEntity>,
    @InjectRepository(OfferingMeritFormulaComponentEntity)
    private readonly offeringComponentsRepo: Repository<OfferingMeritFormulaComponentEntity>,
    @InjectRepository(ProgrammeOfferingEntity)
    private readonly offeringsRepo: Repository<ProgrammeOfferingEntity>,
    @InjectRepository(ProgrammeEntity)
    private readonly programmesRepo: Repository<ProgrammeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createTemplate(
    ctx: RequestContext,
    dto: CreateMeritFormulaTemplateDto,
  ): Promise<MeritFormulaTemplateResponseDto> {
    this.assertWeightsSum100(dto.components);
    this.assertUniqueSources(dto.components);

    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault) {
        await manager.update(
          MeritFormulaTemplateEntity,
          {
            tenantId: ctx.tenantId,
            degreeLevel: dto.degreeLevel,
            isDefault: true,
          },
          { isDefault: false, updatedBy: ctx.userId },
        );
      }

      const template = manager.create(MeritFormulaTemplateEntity, {
        tenantId: ctx.tenantId,
        degreeLevel: dto.degreeLevel,
        name: dto.name,
        description: dto.description ?? null,
        status: MeritFormulaStatus.ACTIVE,
        isDefault: dto.isDefault ?? false,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
      const saved = await manager.save(template);

      await manager.save(
        MeritFormulaTemplateComponentEntity,
        dto.components.map((c, i) =>
          manager.create(MeritFormulaTemplateComponentEntity, {
            tenantId: ctx.tenantId,
            templateId: saved.id,
            sourceType: c.sourceType,
            weight: c.weight.toFixed(2),
            sortOrder: c.sortOrder ?? i + 1,
          }),
        ),
      );

      // Load via the same transaction manager — templatesRepo would miss the
      // uncommitted row and return 404.
      const created = await manager.findOne(MeritFormulaTemplateEntity, {
        where: { id: saved.id, tenantId: ctx.tenantId },
        relations: { components: true },
      });
      if (!created) {
        throw new NotFoundException(
          `Merit formula template ${saved.id} not found`,
        );
      }
      return this.toTemplateResponse(created);
    });
  }

  async listTemplates(
    ctx: RequestContext,
    query: ListMeritFormulaTemplatesQueryDto,
  ): Promise<MeritFormulaTemplateListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: {
      tenantId: string;
      degreeLevel?: string;
      status?: string;
    } = { tenantId: ctx.tenantId };
    if (query.degreeLevel) where.degreeLevel = query.degreeLevel;
    if (query.status) where.status = query.status;

    const [rows, total] = await this.templatesRepo.findAndCount({
      where,
      relations: { components: true },
      order: { degreeLevel: 'ASC', isDefault: 'DESC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((r) => this.toTemplateResponse(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getTemplate(
    ctx: RequestContext,
    templateId: string,
  ): Promise<MeritFormulaTemplateResponseDto> {
    const row = await this.templatesRepo.findOne({
      where: { id: templateId, tenantId: ctx.tenantId },
      relations: { components: true },
    });
    if (!row) {
      throw new NotFoundException(`Merit formula template ${templateId} not found`);
    }
    return this.toTemplateResponse(row);
  }

  async updateTemplate(
    ctx: RequestContext,
    templateId: string,
    dto: UpdateMeritFormulaTemplateDto,
  ): Promise<MeritFormulaTemplateResponseDto> {
    if (dto.components) {
      this.assertWeightsSum100(dto.components);
      this.assertUniqueSources(dto.components);
    }

    return this.dataSource.transaction(async (manager) => {
      const entity = await manager.findOne(MeritFormulaTemplateEntity, {
        where: { id: templateId, tenantId: ctx.tenantId },
      });
      if (!entity) {
        throw new NotFoundException(
          `Merit formula template ${templateId} not found`,
        );
      }

      if (dto.isDefault === true) {
        await manager.update(
          MeritFormulaTemplateEntity,
          {
            tenantId: ctx.tenantId,
            degreeLevel: entity.degreeLevel,
            isDefault: true,
          },
          { isDefault: false, updatedBy: ctx.userId },
        );
        entity.isDefault = true;
      } else if (dto.isDefault === false) {
        entity.isDefault = false;
      }

      if (dto.name !== undefined) entity.name = dto.name;
      if (dto.description !== undefined) entity.description = dto.description;
      if (dto.status !== undefined) entity.status = dto.status;
      entity.updatedBy = ctx.userId;
      await manager.save(entity);

      if (dto.components) {
        await manager.delete(MeritFormulaTemplateComponentEntity, {
          templateId: entity.id,
          tenantId: ctx.tenantId,
        });
        await manager.save(
          MeritFormulaTemplateComponentEntity,
          dto.components.map((c, i) =>
            manager.create(MeritFormulaTemplateComponentEntity, {
              tenantId: ctx.tenantId,
              templateId: entity.id,
              sourceType: c.sourceType,
              weight: c.weight.toFixed(2),
              sortOrder: c.sortOrder ?? i + 1,
            }),
          ),
        );
      }

      const updated = await manager.findOne(MeritFormulaTemplateEntity, {
        where: { id: entity.id, tenantId: ctx.tenantId },
        relations: { components: true },
      });
      if (!updated) {
        throw new NotFoundException(
          `Merit formula template ${entity.id} not found`,
        );
      }
      return this.toTemplateResponse(updated);
    });
  }

  async deleteTemplate(
    ctx: RequestContext,
    templateId: string,
  ): Promise<MeritFormulaTemplateResponseDto> {
    const existing = await this.getTemplate(ctx, templateId);
    const inUse = await this.offeringFormulasRepo.count({
      where: { tenantId: ctx.tenantId, templateId },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Template is attached to ${inUse} offering formula(s); detach or update those first`,
      );
    }
    await this.templatesRepo.delete({ id: templateId, tenantId: ctx.tenantId });
    return existing;
  }

  async upsertOfferingFormula(
    ctx: RequestContext,
    offeringId: string,
    dto: UpsertOfferingMeritFormulaDto,
  ): Promise<OfferingMeritFormulaResponseDto> {
    const { offering, degreeLevel } = await this.requireOfferingWithDegree(
      ctx.tenantId,
      offeringId,
    );

    let components = dto.components;
    let templateId = dto.templateId ?? null;

    if (!components?.length) {
      const template = templateId
        ? await this.templatesRepo.findOne({
            where: {
              id: templateId,
              tenantId: ctx.tenantId,
              status: MeritFormulaStatus.ACTIVE,
            },
            relations: { components: true },
          })
        : await this.templatesRepo.findOne({
            where: {
              tenantId: ctx.tenantId,
              degreeLevel,
              isDefault: true,
              status: MeritFormulaStatus.ACTIVE,
            },
            relations: { components: true },
          });
      if (!template) {
        throw new BadRequestException(
          'Provide components[] or a valid templateId / default template for this degree level',
        );
      }
      templateId = template.id;
      components = template.components
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((c) => ({
          sourceType: c.sourceType as MeritScoreSourceType,
          weight: Number(c.weight),
          sortOrder: c.sortOrder,
        }));
    }

    this.assertWeightsSum100(components);
    this.assertUniqueSources(components);

    return this.dataSource.transaction(async (manager) => {
      let formula = await manager.findOne(OfferingMeritFormulaEntity, {
        where: {
          tenantId: ctx.tenantId,
          programmeOfferingId: offering.id,
        },
      });

      if (!formula) {
        formula = manager.create(OfferingMeritFormulaEntity, {
          tenantId: ctx.tenantId,
          programmeOfferingId: offering.id,
          templateId,
          degreeLevel,
          name: dto.name ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      } else {
        formula.templateId = templateId;
        formula.degreeLevel = degreeLevel;
        if (dto.name !== undefined) formula.name = dto.name;
        formula.updatedBy = ctx.userId;
      }
      formula = await manager.save(formula);

      await manager.delete(OfferingMeritFormulaComponentEntity, {
        offeringFormulaId: formula.id,
        tenantId: ctx.tenantId,
      });
      await manager.save(
        OfferingMeritFormulaComponentEntity,
        components!.map((c, i) =>
          manager.create(OfferingMeritFormulaComponentEntity, {
            tenantId: ctx.tenantId,
            offeringFormulaId: formula!.id,
            sourceType: c.sourceType,
            weight: c.weight.toFixed(2),
            sortOrder: c.sortOrder ?? i + 1,
          }),
        ),
      );

      return this.getOfferingFormula(ctx, offeringId);
    });
  }

  async getOfferingFormula(
    ctx: RequestContext,
    offeringId: string,
  ): Promise<OfferingMeritFormulaResponseDto> {
    const { offering, degreeLevel } = await this.requireOfferingWithDegree(
      ctx.tenantId,
      offeringId,
    );

    const override = await this.offeringFormulasRepo.findOne({
      where: {
        tenantId: ctx.tenantId,
        programmeOfferingId: offering.id,
      },
      relations: { components: true },
    });
    if (override) {
      return this.toOfferingResponse(override, false);
    }

    const template = await this.templatesRepo.findOne({
      where: {
        tenantId: ctx.tenantId,
        degreeLevel,
        isDefault: true,
        status: MeritFormulaStatus.ACTIVE,
      },
      relations: { components: true },
    });
    if (!template) {
      throw new NotFoundException(
        `No offering merit formula and no default template for degree level ${degreeLevel}`,
      );
    }

    return {
      id: template.id,
      tenantId: template.tenantId,
      programmeOfferingId: offering.id,
      templateId: template.id,
      degreeLevel: degreeLevel as DegreeLevel,
      name: template.name,
      components: this.mapComponents(template.components),
      resolvedFromTemplate: true,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  async deleteOfferingFormula(
    ctx: RequestContext,
    offeringId: string,
  ): Promise<{ deleted: boolean; programmeOfferingId: string }> {
    await this.requireOfferingWithDegree(ctx.tenantId, offeringId);
    const result = await this.offeringFormulasRepo.delete({
      tenantId: ctx.tenantId,
      programmeOfferingId: offeringId,
    });
    if (!result.affected) {
      throw new NotFoundException(
        'No offering-specific merit formula to delete (already using degree-level template)',
      );
    }
    return { deleted: true, programmeOfferingId: offeringId };
  }

  /** Snapshot shape for merit list generation (score engine). */
  async resolveFormulaSnapshot(
    tenantId: string,
    offeringId: string,
  ): Promise<MeritFormulaSnapshot> {
    const override = await this.offeringFormulasRepo.findOne({
      where: { tenantId, programmeOfferingId: offeringId },
      relations: { components: true },
    });
    if (override) {
      return {
        degreeLevel: override.degreeLevel,
        source: 'OFFERING',
        templateId: override.templateId,
        offeringFormulaId: override.id,
        components: this.mapComponents(override.components).map((c) => ({
          sourceType: c.sourceType,
          weight: c.weight,
        })),
      };
    }

    const { degreeLevel } = await this.requireOfferingWithDegree(
      tenantId,
      offeringId,
    );
    const template = await this.templatesRepo.findOne({
      where: {
        tenantId,
        degreeLevel,
        isDefault: true,
        status: MeritFormulaStatus.ACTIVE,
      },
      relations: { components: true },
    });
    if (!template) {
      throw new NotFoundException(
        `No merit formula configured for offering ${offeringId}`,
      );
    }
    return {
      degreeLevel,
      source: 'TEMPLATE',
      templateId: template.id,
      offeringFormulaId: null,
      components: this.mapComponents(template.components).map((c) => ({
        sourceType: c.sourceType,
        weight: c.weight,
      })),
    };
  }

  /**
   * Weighted merit = Σ (source% × weight/100).
   * Missing academic sources contribute 0 and mark incomplete.
   */
  computeMeritScore(
    snapshot: MeritFormulaSnapshot,
    academics: Array<{ degreeType: string; percentage: number | string }>,
    entryTestPercentage: number,
  ): MeritScoreResult {
    const byDegree = new Map<string, number>();
    for (const a of academics) {
      const key = String(a.degreeType ?? '')
        .trim()
        .toUpperCase();
      const pct = Number(a.percentage);
      if (!key || !Number.isFinite(pct)) continue;
      const prev = byDegree.get(key);
      if (prev === undefined || pct > prev) byDegree.set(key, pct);
    }

    const entry = Number(entryTestPercentage);
    const safeEntry = Number.isFinite(entry) ? entry : 0;

    const breakdown: MeritScoreBreakdownItem[] = [];
    let meritScore = 0;
    let incomplete = false;

    for (const component of snapshot.components) {
      const source = String(component.sourceType).toUpperCase();
      const weight = Number(component.weight);
      let raw: number | null = null;
      let missing = false;

      if (source === MeritScoreSourceType.ENTRY_TEST) {
        raw = safeEntry;
      } else {
        raw = byDegree.get(source) ?? null;
        if (raw === null) {
          missing = true;
          incomplete = true;
          raw = 0;
        }
      }

      const contribution =
        Math.round(((raw ?? 0) * weight) / 100 * 10000) / 10000;
      meritScore += contribution;
      breakdown.push({
        sourceType: source,
        weight,
        rawPercentage: missing ? null : raw,
        contribution,
        missing,
      });
    }

    return {
      meritScore: Math.round(meritScore * 10000) / 10000,
      breakdown,
      incomplete,
    };
  }

  private async requireOfferingWithDegree(
    tenantId: string,
    offeringId: string,
  ): Promise<{ offering: ProgrammeOfferingEntity; degreeLevel: string }> {
    const offering = await this.offeringsRepo.findOne({
      where: { id: offeringId, tenantId },
    });
    if (!offering) {
      throw new NotFoundException(`Programme offering ${offeringId} not found`);
    }
    const programme = await this.programmesRepo.findOne({
      where: { id: offering.programmeId, tenantId },
    });
    if (!programme) {
      throw new NotFoundException(
        `Programme for offering ${offeringId} was not found`,
      );
    }
    return { offering, degreeLevel: programme.degreeLevel };
  }

  private assertWeightsSum100(components: MeritFormulaComponentInputDto[]): void {
    const sum = components.reduce((acc, c) => acc + Number(c.weight), 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new BadRequestException(
        `Component weights must sum to 100 (got ${sum.toFixed(2)})`,
      );
    }
  }

  private assertUniqueSources(
    components: MeritFormulaComponentInputDto[],
  ): void {
    const sources = components.map((c) => c.sourceType);
    if (new Set(sources).size !== sources.length) {
      throw new BadRequestException(
        'Duplicate sourceType in components is not allowed',
      );
    }
  }

  private mapComponents(
    components: Array<{
      id?: string;
      sourceType: string;
      weight: string | number;
      sortOrder: number | null;
    }>,
  ): MeritFormulaComponentResponseDto[] {
    return [...components]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((c) => ({
        id: c.id ?? '',
        sourceType: c.sourceType as MeritScoreSourceType,
        weight: Number(c.weight),
        sortOrder: c.sortOrder,
      }));
  }

  private toTemplateResponse(
    entity: MeritFormulaTemplateEntity,
  ): MeritFormulaTemplateResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      degreeLevel: entity.degreeLevel as DegreeLevel,
      name: entity.name,
      description: entity.description,
      status: entity.status as MeritFormulaStatus,
      isDefault: entity.isDefault,
      components: this.mapComponents(entity.components ?? []),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toOfferingResponse(
    entity: OfferingMeritFormulaEntity,
    resolvedFromTemplate: boolean,
  ): OfferingMeritFormulaResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      programmeOfferingId: entity.programmeOfferingId,
      templateId: entity.templateId,
      degreeLevel: entity.degreeLevel as DegreeLevel,
      name: entity.name,
      components: this.mapComponents(entity.components ?? []),
      resolvedFromTemplate,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
