const tui = require('./tui');
const db = require('./db');

const BATCH_SIZE = 100;

const REPORTS_BY_DATE_URL = `_design/medic-client/_view/reports_by_date`;
const PURGE_URL = `_purge`;

const getReportsByDateURL = endDateMillis => `${REPORTS_BY_DATE_URL}?include_docs=false&endkey=[${endDateMillis}]`;
const getDocIds = async (endDateMillis) => {
  const response = await db.get(getReportsByDateURL(endDateMillis));
  return response.rows.map(row => row.id);
};

const createBulkGetBody = ids => ({ docs: ids.map(id => ({ id })) });
const hasOkDoc = ({ docs }) => docs && docs.length && docs[0].ok;
const getOkDoc = ({ docs: [{ ok }] }) => ok;
const populateRevsById = (revsById, { _id, _rev }) => {
  revsById[_id] = [_rev];
  return revsById;
};
const getDocRevsById = async (ids) => {
  const response = await db.post('/_bulk_get', createBulkGetBody(ids));
  return response.results
    .filter(hasOkDoc)
    .map(getOkDoc)
    .reduce(populateRevsById, {});
};

const getBatches = (array, size) => Array.from(new Array(Math.ceil(array.length / size)),
  (_, i) => array.slice(i * size, i * size + size)
);

const purge = async (revsById) => db.post(PURGE_URL, revsById);

const purgeReportsAsOfDate = async (date) => {
  tui.log('Purging');
  if (!date) {
    date = await tui.question('Enter date (YYYY-MM-DD). Reports submitted at or before this date will be purged: ');
  }
  const endDateMillis = new Date(date).getTime();
  const ids = await getDocIds(endDateMillis);
  if (!ids.length) {
    tui.log(`No reports found to purge.`);
    return;
  }

  const answer = await tui.question(`Purging ${ids.length} reports. Continue? (y/N): `);
  if (answer !== 'y') {
    return;
  }

  for (const [index, batchIds] of getBatches(ids, BATCH_SIZE).entries()) {
    const startIndex = index * BATCH_SIZE;
    const endIndex = startIndex + batchIds.length;
    tui.log(`Purging reports ${startIndex} - ${endIndex}...`);

    const revsById = await getDocRevsById(batchIds);
    await purge(revsById);
  }
};

module.exports = {
  purgeReportsAsOfDate
};
