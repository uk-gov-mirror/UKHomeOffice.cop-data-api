const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const jwtDecode = require('jwt-decode');
const moment = require('moment');

// local imports
const config = require('../config/core');
const logger = require('../config/logger')(__filename);
const v1 = require('./v1');

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
app.options('*', cors(corsConfiguration));

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

app.use('/v1', v1);
app.get('/_health', (req, res) => {
  logger.verbose('API is Alive & Kicking!');
  return res.status(200).json({ 'status': 'UP' });
});

module.exports = app;