// api/tags.ts
import apiClient from './client';
import { TagsResponse, Tag, TagTypesResponse } from '../types/api';

/**
 * Lista todos os tipos de tags disponíveis no sistema
 */
export const listTagTypes = async (): Promise<TagTypesResponse> => {
  const response = await apiClient.get<TagTypesResponse>('/tag-types');
  return response.data;
};

/**
 * Lista todas as tags de uma organização, opcionalmente filtradas por tipo de tag
 */
export const listTags = async (
  organizationId: string,
  tagType?: string
): Promise<TagsResponse> => {
  const response = await apiClient.get<TagsResponse>('/tags', {
    params: {
      organization_id: organizationId,
      tag_type: tagType, // Opcional: nome do tipo de tag (ex: "categoria")
    },
  });
  return response.data;
};

export const createTag = async (
  organizationId: string,
  name: string,
  tagTypeId: string,
  color?: string
): Promise<Tag> => {
  const response = await apiClient.post<Tag>('/tags', {
    name,
    tag_type_id: tagTypeId,
    color,
  }, {
    params: {
      organization_id: organizationId
    }
  });
  return response.data;
};
