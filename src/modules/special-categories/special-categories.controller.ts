import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardErrorResponses,
  ApiTenantHeaders,
  ApiWrappedCreatedResponse,
  ApiWrappedOkArrayResponse,
  ApiWrappedOkResponse,
} from '../../common/decorators/api-docs.decorator.js';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import {
  ReqContext,
  type RequestContext,
} from '../../common/decorators/request-context.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import {
  ApplicantSpecialCategoriesResponseDto,
  CreateSpecialCategoryDto,
  ListSpecialCategoriesQueryDto,
  ReviewSpecialCategoryClaimDto,
  SaveSpecialCategoryClaimsDto,
  SpecialCategoryClaimResponseDto,
  SpecialCategoryListResponseDto,
  SpecialCategoryResponseDto,
  UpdateSpecialCategoryDto,
} from './dto/special-category.dto.js';
import { SpecialCategoriesService } from './special-categories.service.js';

@ApiTags('Special Categories')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  SpecialCategoryResponseDto,
  SpecialCategoryListResponseDto,
  CreateSpecialCategoryDto,
  UpdateSpecialCategoryDto,
  ApplicantSpecialCategoriesResponseDto,
  SpecialCategoryClaimResponseDto,
  SaveSpecialCategoryClaimsDto,
  ReviewSpecialCategoryClaimDto,
  ApiErrorResponseDto,
)
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@Controller('admissions/special-categories')
export class SpecialCategoriesAdminController {
  constructor(private readonly service: SpecialCategoriesService) {}

  @Get()
  @ApiOperation({
    summary: 'List special categories',
    description:
      'Catalogue of categories that add extra marks to merit (Hafiz-e-Quran, Sports, etc.).',
  })
  @ApiWrappedOkArrayResponse(SpecialCategoryResponseDto, 'Special categories')
  list(
    @ReqContext() ctx: RequestContext,
    @Query() query: ListSpecialCategoriesQueryDto,
  ): Promise<SpecialCategoryListResponseDto> {
    return this.service.list(ctx, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a special category' })
  @ApiWrappedCreatedResponse(SpecialCategoryResponseDto, 'Special category created')
  create(
    @ReqContext() ctx: RequestContext,
    @Body() dto: CreateSpecialCategoryDto,
  ): Promise<SpecialCategoryResponseDto> {
    return this.service.create(ctx, dto);
  }

  @Get('claims/by-applicant/:applicantId')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'List special-category claims for an applicant' })
  @ApiWrappedOkArrayResponse(SpecialCategoryClaimResponseDto, 'Claims')
  listClaims(
    @ReqContext() ctx: RequestContext,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<SpecialCategoryClaimResponseDto[]> {
    return this.service.listClaimsForApplicant(ctx, applicantId);
  }

  @Post('claims/:claimId/review')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'claimId', format: 'uuid' })
  @ApiOperation({ summary: 'Verify or reject an applicant special-category claim' })
  @ApiWrappedOkResponse(SpecialCategoryClaimResponseDto)
  reviewClaim(
    @ReqContext() ctx: RequestContext,
    @Param('claimId', new ParseUuidPipe('claimId')) claimId: string,
    @Body() dto: ReviewSpecialCategoryClaimDto,
  ): Promise<SpecialCategoryClaimResponseDto> {
    return this.service.reviewClaim(ctx, claimId, dto);
  }

  @Get(':categoryId')
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  @ApiOperation({ summary: 'Get a special category' })
  @ApiWrappedOkResponse(SpecialCategoryResponseDto)
  getById(
    @ReqContext() ctx: RequestContext,
    @Param('categoryId', new ParseUuidPipe('categoryId')) id: string,
  ): Promise<SpecialCategoryResponseDto> {
    return this.service.getById(ctx, id);
  }

  @Put(':categoryId')
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  @ApiOperation({ summary: 'Update a special category (bonus marks, status, …)' })
  @ApiWrappedOkResponse(SpecialCategoryResponseDto)
  update(
    @ReqContext() ctx: RequestContext,
    @Param('categoryId', new ParseUuidPipe('categoryId')) id: string,
    @Body() dto: UpdateSpecialCategoryDto,
  ): Promise<SpecialCategoryResponseDto> {
    return this.service.update(ctx, id, dto);
  }

  @Delete(':categoryId')
  @ApiParam({ name: 'categoryId', format: 'uuid' })
  @ApiOperation({
    summary: 'Delete or deactivate a special category',
    description: 'Deletes if unused; otherwise marks INACTIVE.',
  })
  delete(
    @ReqContext() ctx: RequestContext,
    @Param('categoryId', new ParseUuidPipe('categoryId')) id: string,
  ) {
    return this.service.remove(ctx, id);
  }
}

@ApiTags('Applicant Special Categories')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApplicantSpecialCategoriesResponseDto,
  SaveSpecialCategoryClaimsDto,
  SpecialCategoryClaimResponseDto,
  ApiErrorResponseDto,
)
@ApiStandardErrorResponses()
@Controller('applicants/applications/:applicantId/special-categories')
export class ApplicantSpecialCategoriesController {
  constructor(private readonly service: SpecialCategoriesService) {}

  @Get()
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({
    summary: 'List available special categories and current claims',
    description:
      'Returns active categories (with bonus marks) and the applicant’s claims. ' +
      'Eligible CLAIMED/VERIFIED claims add extra marks during merit generation.',
  })
  @ApiWrappedOkResponse(ApplicantSpecialCategoriesResponseDto)
  get(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<ApplicantSpecialCategoriesResponseDto> {
    return this.service.getApplicantSpecialCategories(user, applicantId);
  }

  @Put()
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({
    summary: 'Save applicant special-category claims',
    description:
      'Replaces the claim set with the given category IDs. Female/Disability may auto-verify from profile.',
  })
  @ApiWrappedOkResponse(ApplicantSpecialCategoriesResponseDto)
  save(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: SaveSpecialCategoryClaimsDto,
  ): Promise<ApplicantSpecialCategoriesResponseDto> {
    return this.service.saveApplicantClaims(user, applicantId, dto);
  }
}
