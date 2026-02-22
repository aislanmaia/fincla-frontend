// api/tags.ts
import apiClient from './client';
import {
  TagsResponse,
  Tag,
  TagType,
  TagTypesResponse,
  CreateTagRequest,
  UpdateTagRequest,
  CreateTagTypeRequest,
  UpdateTagTypeRequest,
} from '../types/api';

/**
 * Cria um novo tipo de tag no sistema.
 */
export const createTagType = async (data: CreateTagTypeRequest): Promise<TagType> => {
  const response = await apiClient.post<TagType>('/tag-types', data);
  return response.data;
};

/**
 * Atualiza um tipo de tag existente.
 */
export const updateTagType = async (
  tagTypeId: string,
  data: UpdateTagTypeRequest
): Promise<TagType> => {
  const response = await apiClient.patch<TagType>(`/tag-types/${tagTypeId}`, data);
  return response.data;
};

/**
 * Remove um tipo de tag (pode falhar se houver tags vinculadas).
 */
export const deleteTagType = async (tagTypeId: string): Promise<void> => {
  await apiClient.delete(`/tag-types/${tagTypeId}`);
};

/**
 * Lista todos os tipos de tags disponíveis no sistema.
 * Aceita resposta como { tag_types: [...] } ou array direto (compatibilidade).
 */
export const listTagTypes = async (): Promise<TagTypesResponse> => {
  const response = await apiClient.get<TagTypesResponse | TagType[]>('/tag-types');
  const data = response.data;
  if (Array.isArray(data)) {
    return { tag_types: data };
  }
  return data as TagTypesResponse;
};

/**
 * Lista todas as tags de uma organização, opcionalmente filtradas por tipo de tag.
 * Aceita resposta como { tags: [...] } ou array direto (compatibilidade).
 */
export const listTags = async (
  organizationId: string,
  tagType?: string
): Promise<TagsResponse> => {
  const response = await apiClient.get<TagsResponse | Tag[]>('/tags', {
    params: {
      organization_id: organizationId,
      tag_type: tagType, // Opcional: nome do tipo de tag (ex: "categoria")
    },
  });
  const data = response.data;
  if (Array.isArray(data)) {
    return { tags: data };
  }
  return data as TagsResponse;
};

/**
 * Cria uma nova tag na organização
 */
export const createTag = async (
  organizationId: string,
  data: CreateTagRequest
): Promise<Tag> => {
  const response = await apiClient.post<Tag>('/tags', data, {
    params: { organization_id: organizationId },
  });
  return response.data;
};

/**
 * Atualiza uma tag existente
 */
export const updateTag = async (
  tagId: string,
  data: UpdateTagRequest
): Promise<Tag> => {
  const response = await apiClient.patch<Tag>(`/tags/${tagId}`, data);
  return response.data;
};

/**
 * Remove uma tag (soft delete - is_active=false)
 */
export const deleteTag = async (tagId: string): Promise<void> => {
  await apiClient.delete(`/tags/${tagId}`);
};
