'use strict';

// Public controllers (no login required).
//
// POST /public/requests
// Input:
//   { email, description, address, priority, photos? }
// Output:
//   { token, role:"client", job:{ id, status:"open", createdAt: ISOString } }

const { z } = require('zod');

const { createPublicClientRequest } = require('../services/publicRequests.service');
const { getCompanyConfig } = require('../services/companyConfig.service');

const createPublicRequestSchema = z.object({
  email: z.string().trim().email(),
  description: z.string().trim().min(1),
  address: z.string().trim().min(1),
  priority: z.enum(['low', 'medium', 'high']),
  photos: z.array(z.string().trim().min(1)).optional(),
});

function sendError(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function handleError(res, err) {
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const isBadRequest = status === 400;

  if (isBadRequest) {
    const message = err && typeof err.message === 'string' ? err.message : 'Invalid payload.';
    return sendError(res, 400, 'invalid_payload', message);
  }

  console.error('[public]', err);
  return sendError(res, 500, 'internal_error', 'Internal Server Error');
}

async function postPublicRequest(req, res) {
  let input;
  try {
    input = createPublicRequestSchema.parse(req.body || {});
  } catch (err) {
    return sendError(res, 400, 'invalid_payload', 'Invalid request body.');
  }

  try {
    const result = await createPublicClientRequest(input);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

async function getPublicCompanyConfig(req, res) {
  try {
    const config = await getCompanyConfig();
    return res.status(200).json({ ok: true, data: config });
  } catch (err) {
    console.error('[public/company-config]', err);
    return sendError(res, 500, 'internal_error', 'Internal Server Error');
  }
}

module.exports = {
  postPublicRequest,
  getPublicCompanyConfig,
};
