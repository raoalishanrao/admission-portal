import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type {
  AcademicDocumentResponse,
  AcademicDocumentType,
  AcademicStepResponse,
  ApplicationAddressResponse,
  ApplicationContactResponse,
  DeclarationStepResponse,
  OfferingDeclarationText,
  PaginatedItems,
  ProfilePhotographResponse,
  ProfileStepResponse,
  ProgrammeStepResponse,
  RequiredAcademicLevels,
  SaveAcademicRequest,
  SaveDeclarationRequest,
  SaveProfileRequest,
  SaveProgrammeRequest,
  SubmitApplicationResponse,
  UpdateAcademicRequest,
  AddressFields,
  ContactFields,
} from '@/lib/api/types'

function base(applicantId: string) {
  return applicantId
}

export async function getProgrammeStep(applicantId: string) {
  const response = await apiGet<ProgrammeStepResponse>(
    API_ENDPOINTS.applicationProgramme(base(applicantId)),
  )
  return response.data
}

export async function createProgrammeStep(applicantId: string, body: SaveProgrammeRequest) {
  const response = await apiPost<ProgrammeStepResponse, SaveProgrammeRequest>(
    API_ENDPOINTS.applicationProgramme(base(applicantId)),
    body,
  )
  return response.data
}

export async function updateProgrammeStep(applicantId: string, body: SaveProgrammeRequest) {
  const response = await apiPut<ProgrammeStepResponse, SaveProgrammeRequest>(
    API_ENDPOINTS.applicationProgramme(base(applicantId)),
    body,
  )
  return response.data
}

export async function saveProgrammeStep(
  applicantId: string,
  body: SaveProgrammeRequest,
  alreadySaved: boolean,
) {
  return alreadySaved
    ? updateProgrammeStep(applicantId, body)
    : createProgrammeStep(applicantId, body)
}

export async function getAcademicStep(applicantId: string) {
  const response = await apiGet<AcademicStepResponse>(
    API_ENDPOINTS.applicationAcademic(base(applicantId)),
  )
  return response.data
}

export async function getRequiredAcademicLevels(applicantId: string) {
  const response = await apiGet<RequiredAcademicLevels>(
    API_ENDPOINTS.applicationAcademicRequiredLevels(base(applicantId)),
  )
  return response.data
}

export async function createAcademicStep(applicantId: string, body: SaveAcademicRequest) {
  const response = await apiPost<AcademicStepResponse, SaveAcademicRequest>(
    API_ENDPOINTS.applicationAcademic(base(applicantId)),
    body,
  )
  return response.data
}

export async function updateAcademicStep(applicantId: string, body: UpdateAcademicRequest) {
  const response = await apiPut<AcademicStepResponse, UpdateAcademicRequest>(
    API_ENDPOINTS.applicationAcademic(base(applicantId)),
    body,
  )
  return response.data
}

export async function uploadAcademicDocument(
  applicantId: string,
  academicInformationId: string,
  file: File,
  documentType: AcademicDocumentType,
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('documentType', documentType)
  const response = await apiUpload<AcademicDocumentResponse>(
    API_ENDPOINTS.applicationAcademicDocument(base(applicantId), academicInformationId),
    formData,
  )
  return response.data
}

export async function deleteAcademicDocument(
  applicantId: string,
  academicInformationId: string,
  documentId: string,
) {
  await apiDelete(
    API_ENDPOINTS.applicationAcademicDocumentById(
      base(applicantId),
      academicInformationId,
      documentId,
    ),
  )
}

export async function getAddresses(applicantId: string) {
  const response = await apiGet<
    PaginatedItems<ApplicationAddressResponse> | ApplicationAddressResponse[]
  >(API_ENDPOINTS.applicationAddresses(base(applicantId)))
  return normalizeItemList(response.data)
}

export async function createAddresses(applicantId: string, addresses: AddressFields[]) {
  const response = await apiPost<
    ApplicationAddressResponse | PaginatedItems<ApplicationAddressResponse>,
    { addresses: AddressFields[] }
  >(API_ENDPOINTS.applicationAddresses(base(applicantId)), { addresses })
  return normalizeItemList(response.data)
}

export async function updateAddresses(
  applicantId: string,
  addresses: Array<AddressFields & { id: string }>,
) {
  const response = await apiPut<
    PaginatedItems<ApplicationAddressResponse> | ApplicationAddressResponse[],
    { addresses: Array<AddressFields & { id: string }> }
  >(API_ENDPOINTS.applicationAddresses(base(applicantId)), { addresses })
  return normalizeItemList(response.data)
}

export async function getContacts(applicantId: string) {
  const response = await apiGet<
    PaginatedItems<ApplicationContactResponse> | ApplicationContactResponse[]
  >(API_ENDPOINTS.applicationContacts(base(applicantId)))
  return normalizeItemList(response.data)
}

export async function createContacts(applicantId: string, contacts: ContactFields[]) {
  const response = await apiPost<
    ApplicationContactResponse | PaginatedItems<ApplicationContactResponse>,
    { contacts: ContactFields[] }
  >(API_ENDPOINTS.applicationContacts(base(applicantId)), { contacts })
  return normalizeItemList(response.data)
}

export async function updateContacts(
  applicantId: string,
  contacts: Array<ContactFields & { id: string }>,
) {
  const response = await apiPut<
    PaginatedItems<ApplicationContactResponse> | ApplicationContactResponse[],
    { contacts: Array<ContactFields & { id: string }> }
  >(API_ENDPOINTS.applicationContacts(base(applicantId)), { contacts })
  return normalizeItemList(response.data)
}

function normalizeItemList<T extends { id: string }>(
  data: PaginatedItems<T> | T[] | T | null | undefined,
): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && 'items' in data) {
    return Array.isArray(data.items) ? data.items : []
  }
  if (typeof data === 'object' && 'id' in data) return [data]
  return []
}

export async function getProfileStep(applicantId: string) {
  const response = await apiGet<ProfileStepResponse>(
    API_ENDPOINTS.applicationProfile(base(applicantId)),
  )
  return response.data
}

export async function createProfileStep(applicantId: string, body: SaveProfileRequest) {
  const response = await apiPost<ProfileStepResponse, SaveProfileRequest>(
    API_ENDPOINTS.applicationProfile(base(applicantId)),
    body,
  )
  return response.data
}

export async function updateProfileStep(applicantId: string, body: SaveProfileRequest) {
  const response = await apiPut<ProfileStepResponse, SaveProfileRequest>(
    API_ENDPOINTS.applicationProfile(base(applicantId)),
    body,
  )
  return response.data
}

export async function uploadProfilePhotograph(applicantId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiUpload<ProfilePhotographResponse>(
    API_ENDPOINTS.applicationPhotograph(base(applicantId)),
    formData,
  )
  return response.data
}

export async function getDeclarationTexts(applicantId: string) {
  const response = await apiGet<
    PaginatedItems<OfferingDeclarationText> | OfferingDeclarationText[]
  >(API_ENDPOINTS.applicationDeclarationTexts(base(applicantId)))
  return normalizeItemList(response.data)
}

export async function getDeclarationStep(applicantId: string) {
  const response = await apiGet<DeclarationStepResponse>(
    API_ENDPOINTS.applicationDeclaration(base(applicantId)),
  )
  return response.data
}

export async function createDeclarationStep(applicantId: string, body: SaveDeclarationRequest) {
  const response = await apiPost<DeclarationStepResponse, SaveDeclarationRequest>(
    API_ENDPOINTS.applicationDeclaration(base(applicantId)),
    body,
  )
  return response.data
}

export async function updateDeclarationStep(applicantId: string, body: SaveDeclarationRequest) {
  const response = await apiPut<DeclarationStepResponse, SaveDeclarationRequest>(
    API_ENDPOINTS.applicationDeclaration(base(applicantId)),
    body,
  )
  return response.data
}

export async function submitApplication(applicantId: string) {
  const response = await apiPost<SubmitApplicationResponse, Record<string, never>>(
    API_ENDPOINTS.applicationSubmit(base(applicantId)),
    {},
  )
  return response.data
}
