const { Op, cast, col, where } = require('sequelize');

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_PAGE = parsePositiveInt(process.env.PAGINATION_DEFAULT_PAGE, 1);
const DEFAULT_LIMIT = parsePositiveInt(process.env.PAGINATION_DEFAULT_LIMIT, 10);

const getPaginationParams = (query = {}, defaultLimit = DEFAULT_LIMIT) => {
  const page = parsePositiveInt(query.page, DEFAULT_PAGE);
  const limit = parsePositiveInt(query.limit, defaultLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const getSearchTerm = (query = {}) => {
  const rawValue = query.search ?? query.q ?? query.query ?? query.term;
  if (rawValue === undefined || rawValue === null) return '';
  return String(rawValue).trim();
};

const getModelSearchableFields = (model, excludedFields = []) => {
  const excluded = new Set(excludedFields);
  const modelAlias = model?.name;

  return Object.entries(model.rawAttributes || {})
    .filter(([attributeName, attributeConfig]) => {
      if (excluded.has(attributeName)) return false;

      const typeKey = attributeConfig?.type?.key;
      return typeKey !== 'VIRTUAL' && typeKey !== 'BLOB';
    })
    .map(([attributeName, attributeConfig]) => {
      const columnName = attributeConfig?.field || attributeName;
      return modelAlias ? `${modelAlias}.${columnName}` : columnName;
    });
};

const buildSearchCondition = (field, pattern) => {
  if (!field) return null;

  const normalizedField = String(field)
    .replace(/^\$/, '')
    .replace(/\$$/, '');

  if (!normalizedField) return null;

  return where(cast(col(normalizedField), 'TEXT'), {
    [Op.iLike]: pattern
  });
};

const buildSearchWhere = (model, query = {}, options = {}) => {
  const search = getSearchTerm(query);
  if (!search) return null;

  const baseFields = getModelSearchableFields(model, options.excludedSearchFields);
  const additionalFields = Array.isArray(options.additionalSearchFields)
    ? options.additionalSearchFields
    : [];

  const searchableFields = [...new Set([...baseFields, ...additionalFields])];
  const pattern = `%${search}%`;
  const conditions = searchableFields
    .map((field) => buildSearchCondition(field, pattern))
    .filter(Boolean);

  if (!conditions.length) {
    return null;
  }

  return { [Op.or]: conditions };
};

const mergeWhereConditions = (baseWhere, searchWhere) => {
  if (baseWhere && searchWhere) {
    return { [Op.and]: [baseWhere, searchWhere] };
  }

  return searchWhere || baseWhere;
};

const normalizeCount = (count) => {
  if (Array.isArray(count)) return count.length;

  const parsed = Number(count);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const buildPaginatedResponse = ({ rows, count, page, limit }) => {
  const totalItems = normalizeCount(count);
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 0;

  return {
    data: rows,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
};

const paginateModel = async (model, req, options = {}) => {
  const {
    defaultLimit = DEFAULT_LIMIT,
    additionalSearchFields = [],
    excludedSearchFields = [],
    ...queryOptions
  } = options;
  const { page, limit, offset } = getPaginationParams(req?.query, defaultLimit);
  const searchWhere = buildSearchWhere(model, req?.query, {
    additionalSearchFields,
    excludedSearchFields
  });
  const mergedWhere = mergeWhereConditions(queryOptions.where, searchWhere);

  const result = await model.findAndCountAll({
    ...queryOptions,
    ...(mergedWhere ? { where: mergedWhere } : {}),
    limit,
    offset,
    distinct: queryOptions.distinct ?? Boolean(queryOptions.include),
    ...(searchWhere && queryOptions.include && queryOptions.subQuery === undefined
      ? { subQuery: false }
      : {})
  });

  return buildPaginatedResponse({
    rows: result.rows,
    count: result.count,
    page,
    limit
  });
};

module.exports = {
  DEFAULT_LIMIT,
  getPaginationParams,
  buildPaginatedResponse,
  paginateModel
};
