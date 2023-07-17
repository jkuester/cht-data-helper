const tui = require('./tui');
const db = require('./db');

const BATCH_SIZE = 100;

const REPORTS_BY_DATE_URL = `_design/medic-client/_view/reports_by_date`;
const CONTACTS_BY_TYPE_URL = '_design/medic-client/_view/contacts_by_type';
const PURGE_URL = `_purge`;

const getReportsByDateURL = endDateMillis => `${REPORTS_BY_DATE_URL}?include_docs=false&endkey=[${endDateMillis}]`;
const getContactsByTypeURL = contactType => `${CONTACTS_BY_TYPE_URL}?include_docs=false&key=["${contactType}"]`;

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

const getDocsById = async (ids) => {
  const response = await db.post('/_bulk_get', createBulkGetBody(ids));
  return response.results
    .filter(hasOkDoc)
    .map(getOkDoc);
};

const getContactIds = async (contactType) => {
  const response = await db.get(getContactsByTypeURL(contactType));
  return response.rows.map(row => row.id);
};

const getDocRevsById = async (ids) => (await getDocsById(ids)).reduce(populateRevsById, {});

const getBatches = (array, size) => Array.from(
  new Array(Math.ceil(array.length / size)),
  (_, i) => array.slice(i * size, i * size + size)
);

const purge = async (revsById) => db.post(PURGE_URL, revsById);

const purgeReportsAsOfDate = async (date) => {
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

const getPatientsToPurge = async (ids, endDateMillis) => (await getDocsById(ids))
  .filter(({ role }) => role === 'patient')
  .filter(({ reported_date }) => reported_date <= endDateMillis)
  .map(({ _id, _rev }) => ({ _id, _rev }));

const purgePatientsAsOfDate = async (date, contactType = 'person') => {
  const endDateMillis = new Date(date).getTime();
  const contactIds = await getContactIds(contactType);

  const promisedPatientsToPurge = Array.from(getBatches(contactIds, BATCH_SIZE)
    .entries())
    .map(async ([index, batchIds]) => {
      const startIndex = index * BATCH_SIZE;
      const endIndex = startIndex + batchIds.length;
      tui.log(`Processing contacts ${startIndex} - ${endIndex}...`);
      return getPatientsToPurge(batchIds, endDateMillis);
    });
  const patientsToPurge = (await Promise.all(promisedPatientsToPurge)).flat();

  if (!patientsToPurge.length) {
    tui.log(`No patients found to purge.`);
    return;
  }
  const answer = await tui.question(`Purging ${patientsToPurge.length} patients. Continue? (y/N): `);
  if (answer !== 'y') {
    return;
  }

  await purge(patientsToPurge.reduce(populateRevsById, {}));
};

module.exports = {
  purgeReportsAsOfDate,
  purgePatientsAsOfDate
};
