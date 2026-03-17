const DEFAULT_ALLOWED_HEADERS =
  'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning';
const DEFAULT_ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const DEFAULT_EXPOSED_HEADERS = 'x-refreshed-token';

const parseList = (value = '') =>
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = parseList(process.env.CORS_ORIGINS || '*');
const allowAnyOrigin = allowedOrigins.includes('*');
const requestedCredentials = process.env.CORS_ALLOW_CREDENTIALS === 'true';
const allowCredentials = requestedCredentials && !allowAnyOrigin;

if (requestedCredentials && allowAnyOrigin) {
  console.warn(
    '[CORS] CORS_ALLOW_CREDENTIALS=true con CORS_ORIGINS=* no es valido. Se deshabilitaron credentials.'
  );
}

const allowedHeaders = process.env.CORS_HEADERS || DEFAULT_ALLOWED_HEADERS;
const allowedMethods = process.env.CORS_METHODS || DEFAULT_ALLOWED_METHODS;
const exposedHeaders = process.env.CORS_EXPOSE_HEADERS || DEFAULT_EXPOSED_HEADERS;
const maxAge = Number(process.env.CORS_MAX_AGE || 86400);

const isOriginAllowed = (origin) => allowAnyOrigin || allowedOrigins.includes(origin);

module.exports = function corsMiddleware(req, res, next) {
  const requestOrigin = req.headers.origin;
  const originAllowed = requestOrigin ? isOriginAllowed(requestOrigin) : true;

  if (requestOrigin && !originAllowed) {
    return res.status(403).json({ message: 'Origen no permitido por CORS.' });
  }

  if (requestOrigin) {
    res.header(
      'Access-Control-Allow-Origin',
      allowAnyOrigin && !allowCredentials ? '*' : requestOrigin
    );
    res.header('Vary', 'Origin');
  } else if (allowAnyOrigin && !allowCredentials) {
    res.header('Access-Control-Allow-Origin', '*');
  }

  if (allowCredentials && requestOrigin) {
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.header('Access-Control-Allow-Methods', allowedMethods);
  res.header(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] || allowedHeaders
  );

  if (exposedHeaders) {
    res.header('Access-Control-Expose-Headers', exposedHeaders);
  }

  if (Number.isFinite(maxAge) && maxAge > 0) {
    res.header('Access-Control-Max-Age', String(maxAge));
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  return next();
};
