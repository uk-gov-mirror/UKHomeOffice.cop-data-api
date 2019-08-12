const express = require('express');

// local imports
const logger = require('../../config/logger')(__filename);
const query = require('../../db/query');
const {
  deleteQueryBuilder,
  insertIntoQueryBuilder,
  selectQueryBuilder,
  updateQueryBuilder,
} = require('../../db/utils');

const app = express();

app.get('/:name', (req, res) => {
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

app.post('/:name', (req, res) => {
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

app.patch('/:name/:id?', (req, res) => {
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

app.delete('/:name', (req, res) => {
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

app.post('/rpc/:name', (req, res) => {
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
