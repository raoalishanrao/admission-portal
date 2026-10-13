import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import { ApplicationStatus } from '../../common/enums/application-status.enum.js';
import { EDITABLE_OFFERING_STATUSES } from '../../common/enums/offering-status.enum.js';
import {
  SpecialCategoryClaimStatus,
  SpecialCategoryCode,
  SpecialCategoryStatus,
} from '../../common/enums/special-category.enum.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ApplicationProgrammeOptionEntity } from '../../database/entities/application-programme-options.entity.js';
import { ApplicationSpecialCategoryClaimEntity } from '../../database/entities/application-special-category-claim.entity.js';
import { ApplicationEntity } from '../../database/entities/application.entity.js';
import { OfferingSpecialCategoryEntity } from '../../database/entities/offering-special-category.entity.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import { SpecialCategoryEntity } from '../../database/entities/special-category.entity.js';
import type {
  ApplicantSpecialCategoriesResponseDto,
  CreateSpecialCategoryDto,
  ListSpecialCategoriesQueryDto,
  OfferingSpecialCategoriesResponseDto,
  ReviewSpecialCategoryClaimDto,
  SaveSpecialCategoryClaimsDto,
  SetOfferingSpecialCategoriesDto,
  SpecialCategoryClaimResponseDto,
  SpecialCategoryListResponseDto,
  SpecialCategoryResponseDto,
  UpdateSpecialCategoryDto,
} from './dto/special-category.dto.js';

const STAFF_ROLES = new Set([
  'ADMISSION_MANAGER',
  'ADMISSIONS_MANAGER',
  'ADMISSIONS_ADMIN',
  'ADMISSIONS_OFFICER',
  'ADMIN',
  'SUPER_ADMIN',
]);

const DEFAULT_CATEGORIES: Array<{
  code: SpecialCategoryCode;
  name: string;
  description: string;
  bonusMarks: number;
  requiresEvidence: boolean;
  sortOrder: number;
}> = [
  {
    code: SpecialCategoryCode.HAFIZ_E_QURAN,
    name: 'Hafiz-e-Quran',
    description: 'Extra marks for Hafiz-e-Quran',
    bonusMarks: 5,
    requiresEvidence: true,
    sortOrder: 1,
  },
  {
    code: SpecialCategoryCode.SPORTS,
    name: 'Sports',
    description: 'Extra marks for sports distinction',
    bonusMarks: 2,
    requiresEvidence: true,
    sortOrder: 2,
  },
  {
    code: SpecialCategoryCode.DIPLOMA,
    name: 'Diploma',
    description: 'Extra marks for relevant diploma',
    bonusMarks: 2,
    requiresEvidence: true,
    sortOrder: 3,
  },
  {
    code: SpecialCategoryCode.DISABILITY,
    name: 'Disability',
    description: 'Extra marks for declared disability',
    bonusMarks: 5,
    requiresEvidence: true,
    sortOrder: 4,
  },
  {
    code: SpecialCategoryCode.FEMALE,
    name: 'Female',
    description: 'Extra marks for female applicants',
    bonusMarks: 2,
    requiresEvidence: false,
    sortOrder: 5,
  },
];

export type SpecialCategoryBonusItem = {
  code: string;
  name: string;
  bonusMarks: number;
  claimStatus: string;
  specialCategoryId: string;
};

@Injectable()
export class SpecialCategoriesService {
  constructor(
    @InjectRepository(SpecialCategoryEntity)
    private readonly categories: Repository<SpecialCategoryEntity>,
    @InjectRepository(OfferingSpecialCategoryEntity)
    private readonly offeringLinks: Repository<OfferingSpecialCategoryEntity>,
    @InjectRepository(ApplicationSpecialCategoryClaimEntity)
    private readonly claims: Repository<ApplicationSpecialCategoryClaimEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationProgrammeOptionEntity)
    private readonly programmeOptions: Repository<ApplicationProgrammeOptionEntity>,
    @InjectRepository(ProgrammeOfferingEntity)
    private readonly offerings: Repository<ProgrammeOfferingEntity>,
  ) {}

  /* ── Admin catalogue ───────────────────────────────────────────── */

  async list(
    ctx: RequestContext,
    query: ListSpecialCategoriesQueryDto,
  ): Promise<SpecialCategoryListResponseDto> {
    this.assertStaff(ctx);
    await this.ensureDefaults(ctx.tenantId, ctx.userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: { tenantId: string; status?: string } = {
      tenantId: ctx.tenantId,
    };
    if (query.status) where.status = query.status;
    const [rows, total] = await this.categories.findAndCount({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: rows.map((r) => this.toCategory(r)),
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
  ): Promise<SpecialCategoryResponseDto> {
    this.assertStaff(ctx);
    return this.toCategory(await this.requireCategory(ctx.tenantId, id));
  }

  async create(
    ctx: RequestContext,
    dto: CreateSpecialCategoryDto,
  ): Promise<SpecialCategoryResponseDto> {
    this.assertStaff(ctx);
    const existing = await this.categories.findOne({
      where: { tenantId: ctx.tenantId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Special category ${dto.code} already exists`);
    }
    const saved = await this.categories.save(
      this.categories.create({
        tenantId: ctx.tenantId,
        code: dto.code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        bonusMarks: String(dto.bonusMarks),
        stackable: dto.stackable ?? true,
        requiresEvidence: dto.requiresEvidence ?? false,
        status: dto.status ?? SpecialCategoryStatus.ACTIVE,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      }),
    );
    return this.toCategory(saved);
  }

  async update(
    ctx: RequestContext,
    id: string,
    dto: UpdateSpecialCategoryDto,
  ): Promise<SpecialCategoryResponseDto> {
    this.assertStaff(ctx);
    const row = await this.requireCategory(ctx.tenantId, id);
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.bonusMarks !== undefined) row.bonusMarks = String(dto.bonusMarks);
    if (dto.stackable !== undefined) row.stackable = dto.stackable;
    if (dto.requiresEvidence !== undefined) {
      row.requiresEvidence = dto.requiresEvidence;
    }
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    row.updatedBy = ctx.userId;
    return this.toCategory(await this.categories.save(row));
  }

  async remove(
    ctx: RequestContext,
    id: string,
  ): Promise<{ deleted: true; id: string }> {
    this.assertStaff(ctx);
    const row = await this.requireCategory(ctx.tenantId, id);
    const used = await this.claims.exists({
      where: { tenantId: ctx.tenantId, specialCategoryId: id },
    });
    if (used) {
      row.status = SpecialCategoryStatus.INACTIVE;
      row.updatedBy = ctx.userId;
      await this.categories.save(row);
      return { deleted: true, id };
    }
    // Clear offering links before hard delete (DB also cascades).
    await this.offeringLinks.delete({ tenantId: ctx.tenantId, specialCategoryId: id });
    await this.categories.remove(row);
    return { deleted: true, id };
  }

  /* ── Offering links ────────────────────────────────────────────── */

  async listOfferingSpecialCategories(
    ctx: RequestContext,
    offeringId: string,
  ): Promise<OfferingSpecialCategoriesResponseDto> {
    this.assertStaff(ctx);
    await this.requireOffering(ctx.tenantId, offeringId);
    const links = await this.offeringLinks.find({
      where: { tenantId: ctx.tenantId, programmeOfferingId: offeringId },
    });
    if (!links.length) {
      return { programmeOfferingId: offeringId, items: [] };
    }
    const cats = await this.categories.find({
      where: {
        tenantId: ctx.tenantId,
        id: In(links.map((l) => l.specialCategoryId)),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return {
      programmeOfferingId: offeringId,
      items: cats.map((c) => this.toCategory(c)),
    };
  }

  async setOfferingSpecialCategories(
    ctx: RequestContext,
    offeringId: string,
    dto: SetOfferingSpecialCategoriesDto,
  ): Promise<OfferingSpecialCategoriesResponseDto> {
    this.assertStaff(ctx);
    const offering = await this.requireOffering(ctx.tenantId, offeringId);
    this.assertOfferingEditable(offering);

    const requestedIds = [...new Set(dto.specialCategoryIds)];
    const cats =
      requestedIds.length === 0
        ? []
        : await this.categories.find({
            where: {
              tenantId: ctx.tenantId,
              id: In(requestedIds),
              status: SpecialCategoryStatus.ACTIVE,
            },
          });
    if (cats.length !== requestedIds.length) {
      throw new BadRequestException(
        'One or more special categories are invalid or inactive',
      );
    }

    const existing = await this.offeringLinks.find({
      where: { tenantId: ctx.tenantId, programmeOfferingId: offeringId },
    });
    const keep = new Set(requestedIds);
    const toRemove = existing.filter((row) => !keep.has(row.specialCategoryId));
    if (toRemove.length) await this.offeringLinks.remove(toRemove);

    const existingIds = new Set(existing.map((r) => r.specialCategoryId));
    const toAdd = requestedIds.filter((id) => !existingIds.has(id));
    if (toAdd.length) {
      await this.offeringLinks.save(
        toAdd.map((specialCategoryId) =>
          this.offeringLinks.create({
            tenantId: ctx.tenantId,
            programmeOfferingId: offeringId,
            specialCategoryId,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          }),
        ),
      );
    }

    return this.listOfferingSpecialCategories(ctx, offeringId);
  }

  /* ── Applicant claims ──────────────────────────────────────────── */

  async getApplicantSpecialCategories(
    user: AuthUser,
    applicantId: string,
  ): Promise<ApplicantSpecialCategoriesResponseDto> {
    const app = await this.requireOwned(user, applicantId);
    await this.ensureDefaults(app.tenantId, user.userId);
    const availableIds = await this.categoryIdsForApplicantOfferings(
      app.tenantId,
      applicantId,
    );
    const available =
      availableIds.length === 0
        ? []
        : await this.categories.find({
            where: {
              tenantId: app.tenantId,
              id: In(availableIds),
              status: SpecialCategoryStatus.ACTIVE,
            },
            order: { sortOrder: 'ASC', name: 'ASC' },
          });
    const claims = await this.claims.find({
      where: { tenantId: app.tenantId, applicantId },
    });
    const byId = new Map(available.map((c) => [c.id, c]));
    // Include inactive / unlinked categories still claimed.
    const missingIds = claims
      .map((c) => c.specialCategoryId)
      .filter((id) => !byId.has(id));
    if (missingIds.length) {
      for (const cat of await this.categories.findBy({ id: In(missingIds) })) {
        byId.set(cat.id, cat);
      }
    }
    const claimDtos = claims
      .map((claim) => {
        const cat = byId.get(claim.specialCategoryId);
        if (!cat) return null;
        return this.toClaim(claim, cat);
      })
      .filter((x): x is SpecialCategoryClaimResponseDto => x != null);

    const availableIdSet = new Set(available.map((c) => c.id));
    const eligibleForApplicant = claimDtos.filter((c) =>
      availableIdSet.has(c.specialCategoryId),
    );

    return {
      available: available.map((c) => this.toCategory(c)),
      claims: claimDtos,
      totalBonusMarks: this.sumEligibleBonus(eligibleForApplicant),
    };
  }

  async saveApplicantClaims(
    user: AuthUser,
    applicantId: string,
    dto: SaveSpecialCategoryClaimsDto,
  ): Promise<ApplicantSpecialCategoriesResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    await this.ensureDefaults(app.tenantId, user.userId);

    const allowedIds = new Set(
      await this.categoryIdsForApplicantOfferings(app.tenantId, applicantId),
    );
    const existing = await this.claims.find({
      where: { tenantId: app.tenantId, applicantId },
    });
    const existingByCat = new Map(
      existing.map((c) => [c.specialCategoryId, c]),
    );

    const requestedIds = [...new Set(dto.specialCategoryIds)];
    for (const id of requestedIds) {
      // New claims must be enabled for the applicant's selected offerings.
      // Existing claims (e.g. after programme change) may be retained.
      if (!allowedIds.has(id) && !existingByCat.has(id)) {
        throw new BadRequestException(
          'One or more special categories are not enabled for your selected programmes',
        );
      }
    }
    const cats =
      requestedIds.length === 0
        ? []
        : await this.categories.find({
            where: {
              tenantId: app.tenantId,
              id: In(requestedIds),
              status: SpecialCategoryStatus.ACTIVE,
            },
          });
    if (cats.length !== requestedIds.length) {
      throw new BadRequestException(
        'One or more special categories are invalid or inactive',
      );
    }

    const catById = new Map(cats.map((c) => [c.id, c]));
    for (const cat of cats) {
      this.assertClaimAllowed(app, cat);
    }

    const keep = new Set(requestedIds);

    for (const row of existing) {
      if (!keep.has(row.specialCategoryId)) {
        // Keep orphan claims when the category is no longer offered for current programmes.
        if (!allowedIds.has(row.specialCategoryId)) {
          continue;
        }
        if (row.status === SpecialCategoryClaimStatus.VERIFIED) {
          throw new ConflictException(
            'Cannot remove a verified special category claim; contact admissions',
          );
        }
        await this.claims.remove(row);
      }
    }

    for (const categoryId of requestedIds) {
      const cat = catById.get(categoryId)!;
      const prior = existingByCat.get(categoryId);
      const autoVerified = this.shouldAutoVerify(app, cat);
      if (!prior) {
        await this.claims.save(
          this.claims.create({
            tenantId: app.tenantId,
            applicantId,
            specialCategoryId: categoryId,
            status: autoVerified
              ? SpecialCategoryClaimStatus.VERIFIED
              : SpecialCategoryClaimStatus.CLAIMED,
            rejectionReason: null,
            reviewedBy: autoVerified ? user.userId : null,
            reviewedAt: autoVerified ? new Date() : null,
            createdBy: user.userId,
            updatedBy: user.userId,
          }),
        );
      } else if (prior.status === SpecialCategoryClaimStatus.REJECTED) {
        prior.status = autoVerified
          ? SpecialCategoryClaimStatus.VERIFIED
          : SpecialCategoryClaimStatus.CLAIMED;
        prior.rejectionReason = null;
        prior.reviewedBy = autoVerified ? user.userId : null;
        prior.reviewedAt = autoVerified ? new Date() : null;
        prior.updatedBy = user.userId;
        await this.claims.save(prior);
      } else if (
        autoVerified &&
        prior.status === SpecialCategoryClaimStatus.CLAIMED
      ) {
        prior.status = SpecialCategoryClaimStatus.VERIFIED;
        prior.reviewedBy = user.userId;
        prior.reviewedAt = new Date();
        prior.updatedBy = user.userId;
        await this.claims.save(prior);
      }
    }

    return this.getApplicantSpecialCategories(user, applicantId);
  }

  async reviewClaim(
    ctx: RequestContext,
    claimId: string,
    dto: ReviewSpecialCategoryClaimDto,
  ): Promise<SpecialCategoryClaimResponseDto> {
    this.assertStaff(ctx);
    if (
      dto.status !== SpecialCategoryClaimStatus.VERIFIED &&
      dto.status !== SpecialCategoryClaimStatus.REJECTED
    ) {
      throw new BadRequestException('status must be VERIFIED or REJECTED');
    }
    if (
      dto.status === SpecialCategoryClaimStatus.REJECTED &&
      !dto.rejectionReason?.trim()
    ) {
      throw new BadRequestException('rejectionReason is required when rejecting');
    }
    const claim = await this.claims.findOneBy({
      id: claimId,
      tenantId: ctx.tenantId,
    });
    if (!claim) throw new NotFoundException('Special category claim not found');
    const cat = await this.requireCategory(
      ctx.tenantId,
      claim.specialCategoryId,
    );
    claim.status = dto.status;
    claim.rejectionReason =
      dto.status === SpecialCategoryClaimStatus.REJECTED
        ? dto.rejectionReason!.trim()
        : null;
    claim.reviewedBy = ctx.userId;
    claim.reviewedAt = new Date();
    claim.updatedBy = ctx.userId;
    await this.claims.save(claim);
    return this.toClaim(claim, cat);
  }

  async listClaimsForApplicant(
    ctx: RequestContext,
    applicantId: string,
  ): Promise<SpecialCategoryClaimResponseDto[]> {
    this.assertStaff(ctx);
    const app = await this.applications.findOneBy({
      id: applicantId,
      tenantId: ctx.tenantId,
    });
    if (!app) throw new NotFoundException('Application not found');
    const claims = await this.claims.find({
      where: { tenantId: ctx.tenantId, applicantId },
      order: { createdAt: 'ASC' },
    });
    const cats = await this.categories.findBy({
      id: In(claims.map((c) => c.specialCategoryId)),
    });
    const byId = new Map(cats.map((c) => [c.id, c]));
    return claims
      .map((claim) => {
        const cat = byId.get(claim.specialCategoryId);
        return cat ? this.toClaim(claim, cat) : null;
      })
      .filter((x): x is SpecialCategoryClaimResponseDto => x != null);
  }

  /**
   * Eligible bonus marks for merit generation (CLAIMED or VERIFIED).
   * When programmeOfferingId is set, only categories linked to that offering count.
   */
  async getEligibleBonusesForApplicants(
    tenantId: string,
    applicantIds: string[],
    programmeOfferingId?: string,
  ): Promise<Map<string, SpecialCategoryBonusItem[]>> {
    const result = new Map<string, SpecialCategoryBonusItem[]>();
    if (!applicantIds.length) return result;

    let allowedCategoryIds: Set<string> | null = null;
    if (programmeOfferingId) {
      const links = await this.offeringLinks.find({
        where: { tenantId, programmeOfferingId },
      });
      allowedCategoryIds = new Set(links.map((l) => l.specialCategoryId));
      if (allowedCategoryIds.size === 0) return result;
    }

    const claims = await this.claims.find({
      where: {
        tenantId,
        applicantId: In(applicantIds),
        status: In([
          SpecialCategoryClaimStatus.CLAIMED,
          SpecialCategoryClaimStatus.VERIFIED,
        ]),
      },
    });
    if (!claims.length) return result;

    const cats = await this.categories.find({
      where: {
        tenantId,
        id: In([...new Set(claims.map((c) => c.specialCategoryId))]),
        status: SpecialCategoryStatus.ACTIVE,
      },
    });
    const catById = new Map(cats.map((c) => [c.id, c]));

    for (const claim of claims) {
      if (
        allowedCategoryIds &&
        !allowedCategoryIds.has(claim.specialCategoryId)
      ) {
        continue;
      }
      const cat = catById.get(claim.specialCategoryId);
      if (!cat) continue;
      const bonus = Number(cat.bonusMarks);
      if (!Number.isFinite(bonus) || bonus <= 0) continue;
      const list = result.get(claim.applicantId) ?? [];
      list.push({
        code: cat.code,
        name: cat.name,
        bonusMarks: bonus,
        claimStatus: claim.status,
        specialCategoryId: cat.id,
      });
      result.set(claim.applicantId, list);
    }

    // Non-stackable: keep highest single bonus only when any claim is non-stackable.
    for (const [applicantId, items] of result) {
      const hasNonStackable = items.some((item) => {
        const cat = catById.get(item.specialCategoryId);
        return cat && !cat.stackable;
      });
      if (!hasNonStackable) continue;
      const best = [...items].sort((a, b) => b.bonusMarks - a.bonusMarks)[0];
      result.set(applicantId, best ? [best] : []);
    }

    return result;
  }

  /* ── Helpers ───────────────────────────────────────────────────── */

  /** Union of special category IDs linked to the applicant's selected offerings. */
  private async categoryIdsForApplicantOfferings(
    tenantId: string,
    applicantId: string,
  ): Promise<string[]> {
    const options = await this.programmeOptions.find({
      where: { tenantId, applicantId },
    });
    if (!options.length) return [];
    const offeringIds = [
      ...new Set(options.map((o) => o.programmeOfferingId)),
    ];
    const links = await this.offeringLinks.find({
      where: {
        tenantId,
        programmeOfferingId: In(offeringIds),
      },
    });
    return [...new Set(links.map((l) => l.specialCategoryId))];
  }

  private async requireOffering(tenantId: string, offeringId: string) {
    const row = await this.offerings.findOneBy({ id: offeringId, tenantId });
    if (!row) throw new NotFoundException('Programme offering not found');
    return row;
  }

  private assertOfferingEditable(row: ProgrammeOfferingEntity) {
    if (
      !EDITABLE_OFFERING_STATUSES.includes(row.offeringStatus as never)
    ) {
      throw new ConflictException(
        'Special categories can only be configured while the offering is editable',
      );
    }
  }

  private async ensureDefaults(tenantId: string, userId: string) {
    const count = await this.categories.count({ where: { tenantId } });
    if (count > 0) return;
    await this.categories.save(
      DEFAULT_CATEGORIES.map((item) =>
        this.categories.create({
          tenantId,
          code: item.code,
          name: item.name,
          description: item.description,
          bonusMarks: String(item.bonusMarks),
          stackable: true,
          requiresEvidence: item.requiresEvidence,
          status: SpecialCategoryStatus.ACTIVE,
          sortOrder: item.sortOrder,
          createdBy: userId,
          updatedBy: userId,
        }),
      ),
    );
  }

  private assertClaimAllowed(
    app: ApplicationEntity,
    cat: SpecialCategoryEntity,
  ) {
    if (cat.code === SpecialCategoryCode.FEMALE) {
      const gender = (app.gender ?? '').trim().toUpperCase();
      if (gender && gender !== 'FEMALE') {
        throw new BadRequestException(
          'Female special category requires gender FEMALE on the profile',
        );
      }
    }
    if (cat.code === SpecialCategoryCode.DISABILITY) {
      if (app.disabilityDeclared === false) {
        throw new BadRequestException(
          'Disability special category requires disabilityDeclared on the profile',
        );
      }
    }
  }

  private shouldAutoVerify(
    app: ApplicationEntity,
    cat: SpecialCategoryEntity,
  ): boolean {
    if (cat.code === SpecialCategoryCode.FEMALE) {
      return (app.gender ?? '').trim().toUpperCase() === 'FEMALE';
    }
    if (cat.code === SpecialCategoryCode.DISABILITY) {
      return app.disabilityDeclared === true;
    }
    return false;
  }

  private sumEligibleBonus(claims: SpecialCategoryClaimResponseDto[]): number {
    return claims
      .filter(
        (c) =>
          c.status === SpecialCategoryClaimStatus.CLAIMED ||
          c.status === SpecialCategoryClaimStatus.VERIFIED,
      )
      .reduce((sum, c) => sum + Number(c.bonusMarks || 0), 0);
  }

  private async requireCategory(tenantId: string, id: string) {
    const row = await this.categories.findOneBy({ id, tenantId });
    if (!row) throw new NotFoundException('Special category not found');
    return row;
  }

  private async requireOwned(user: AuthUser, applicantId: string) {
    const app = await this.applications.findOneBy({
      id: applicantId,
      tenantId: user.tenantId,
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.iamUserId !== user.userId) {
      throw new ForbiddenException('You do not own this application');
    }
    return app;
  }

  private async requireOwnedEditable(user: AuthUser, applicantId: string) {
    const app = await this.requireOwned(user, applicantId);
    if (
      app.applicationStatus === ApplicationStatus.COMPLETE ||
      app.applicationStatus === ApplicationStatus.SUBMITTED ||
      app.applicationStatus === ApplicationStatus.APPROVED ||
      app.applicationStatus === ApplicationStatus.REJECTED
    ) {
      throw new BusinessException(
        'Submitted applications are read-only',
        HttpStatus.CONFLICT,
        'APPLICATION_READ_ONLY',
      );
    }
    return app;
  }

  private assertStaff(user: RequestContext | AuthUser) {
    const roles = user.roles ?? [];
    if (!roles.some((r) => STAFF_ROLES.has(String(r).toUpperCase()))) {
      throw new ForbiddenException('Staff role required');
    }
  }

  private toCategory(row: SpecialCategoryEntity): SpecialCategoryResponseDto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      code: row.code,
      name: row.name,
      description: row.description,
      bonusMarks: Number(row.bonusMarks),
      stackable: row.stackable,
      requiresEvidence: row.requiresEvidence,
      status: row.status,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toClaim(
    claim: ApplicationSpecialCategoryClaimEntity,
    cat: SpecialCategoryEntity,
  ): SpecialCategoryClaimResponseDto {
    return {
      id: claim.id,
      applicantId: claim.applicantId,
      specialCategoryId: claim.specialCategoryId,
      categoryCode: cat.code,
      categoryName: cat.name,
      bonusMarks: Number(cat.bonusMarks),
      requiresEvidence: cat.requiresEvidence,
      status: claim.status,
      rejectionReason: claim.rejectionReason,
      reviewedAt: claim.reviewedAt ? claim.reviewedAt.toISOString() : null,
    };
  }
}
