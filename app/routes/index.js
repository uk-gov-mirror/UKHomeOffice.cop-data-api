const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const jwtDecode = require('jwt-decode');
const moment = require('moment');

// local imports
const config = require('../config/core');
const query = require('../db/query');
const logger = require('../config/logger')(__filename);
const {
  deleteQueryBuilder,
  insertIntoQueryBuilder,
  selectQueryBuilder,
  updateQueryBuilder,
} = require('../db/utils');

const app = express();
const corsConfiguration = {
  'origin': '*',
  'methods': ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  'allowedHeaders': ['Content-Type', 'Authorization'],
};
app.use(cors(corsConfiguration));
// 'extended': 'true' allows the values of the objects passed, to be of any type
app.use(bodyParser.urlencoded({ 'extended': 'true' }));
app.use(bodyParser.json());
// check each request for authorization token
app.use((req, res, next) => {
  if (req.headers.authorization) {
    // decode the keycloak jwt token
    const token = jwtDecode(req.headers.authorization);
    const tokenExpiryDate = moment(token.exp * 1000);
    const currentDate = moment(new Date());

    // 1 - check token belongs to our SSO
    // 2 - check our client id is present in aud claim
    // 3 - check if the token expiry time is in the future
    if (token.iss !== config.iss) {
      logger.error(`${req.method} - ${req.url} - Request by ${token.name}, Token not valid for our SSO endpoint - token presented: ${token.iss}`);
      res.status(401).json({ 'error': 'Unauthorized' });
    } else if (token.aud.indexOf(config.keycloak_client_id) === -1) {
      logger.error(`${req.method} - ${req.url} - Request by ${token.name}, Token did not present the correct audience claims for this endpoint - token aud presented: ${token.aud}`);
      res.status(401).json({ 'error': 'Unauthorized' });
    } else if (currentDate.unix() < tokenExpiryDate.unix()) {
      logger.info(`${req.method} - ${req.url} - Request by ${token.name}, ${token.email} - Token valid until - ${tokenExpiryDate.format()}`);
      res.locals.user = token;
      // process request
      next();
    } else {
      logger.error(`${req.method} - ${req.url} - Request by ${token.name}, ${token.email} - Unauthorized - Token expired at ${tokenExpiryDate.format()}`);
      res.status(401).json({ 'error': 'Unauthorized' });
    }
  } else if (req.path !== '/_health') {
    // not an health check and no authorization token was passed,
    // don't process the request further
    res.status(401).json({ 'error': 'Unauthorized' });
  } else {
    // process request for `/_health`
    next();
  }
});

app.options('*', cors(corsConfiguration));

app.get('/_health', (req, res) => {
  logger.verbose('API is Alive & Kicking!');
  return res.status(200).json({ 'status': 'UP' });
});

app.get('/v1/:name', (req, res) => {
  const { name } = req.params;
  const { dbrole } = res.locals.user;
  const queryParams = req.url.split('?')[1];
  const queryString = selectQueryBuilder({ name, queryParams });

  if (!queryString) {
    return res.status(400).json({ 'error': 'Invalid query parameters' });
  }

  const data = query(dbrole, name, queryString);

  Promise.all([data])
    .then(resultsArray => res.status(200).json(resultsArray[0]))
    .catch((error) => {
      logger.error(error.stack);
      res.status(400).json({ 'error': error.message });
    });
});

app.post('/v1/:name', (req, res) => {
  const { body } = req;
  const { dbrole } = res.locals.user;
  const { name } = req.params;
  const { prefer } = req.headers;

  if (Object.entries(body).length === 0) {
    return res.status(400).json({ 'error': 'Invalid post request' });
  }

  const queryString = insertIntoQueryBuilder({ name, body, prefer });
  const data = query(dbrole, name, queryString);

  Promise.all([data])
    .then(resultsArray => res.status(200).json(resultsArray[0]))
    .catch((error) => {
      logger.error(error.stack);
      res.status(400).json({ 'error': error.message });
    });
});

app.patch('/v1/:name/:id?', (req, res) => {
  const { body } = req;
  const { dbrole } = res.locals.user;
  const { id, name } = req.params;
  const { prefer } = req.headers;
  const queryParams = req.url.split('?')[1];

  if (Object.entries(body).length === 0 && (!id || !queryParams)) {
    return res.status(400).json({ 'error': 'Invalid patch request' });
  }

  const queryString = updateQueryBuilder({ name, body, id, queryParams, prefer });
  const data = query(dbrole, name, queryString);

  Promise.all([data])
    .then(resultsArray => res.status(200).json(resultsArray[0]))
    .catch((error) => {
      logger.error(error.stack);
      res.status(400).json({ 'error': error.message });
    });
});

app.delete('/v1/:name', (req, res) => {
  const { name } = req.params;
  const { dbrole } = res.locals.user;
  const queryParams = req.url.split('?')[1];

  if (!queryParams) {
    return res.status(400).json({ 'error': 'Invalid query parameters' });
  }

  const queryString = deleteQueryBuilder({ name, queryParams });
  const data = query(dbrole, name, queryString);

  Promise.all([data])
    .then(resultsArray => res.status(200).json(resultsArray[0]))
    .catch((error) => {
      logger.error(error.stack);
      res.status(400).json({ 'error': error.message });
    });
});

app.post('/v1/rpc/:name', (req, res) => {
  const { body } = req;
  const { dbrole } = res.locals.user;
  const { name } = req.params;
  const queryParams = req.url.split('?')[1];
  const queryString = selectQueryBuilder({ name, queryParams, body });

  if (!queryString) {
    return res.status(400).json({ 'error': 'Invalid query parameters' });
  }

  const data = query(dbrole, name, queryString);
  Promise.all([data])
    .then(resultsArray => res.status(200).json(resultsArray[0]))
    .catch((error) => {
      logger.error(error.stack);
      res.status(400).json({ 'error': error.message });
    });
});

module.exports = app;
