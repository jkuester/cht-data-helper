const COUCH_URL = process.env.COUCH_URL;
const COUCH_URL_PATTERN = /^(https?:\/\/)(.+):(.+)@(.+)\/medic$/g;
const [
  ,
  PROTOCOL,
  ADMIN_USER,
  ADMIN_PASS,
  HOST
] = COUCH_URL_PATTERN.exec(COUCH_URL);
const MEDIC_DB_URL = `${PROTOCOL}${HOST}/medic`;
const AUTH_HEADER = `Basic ${Buffer.from(ADMIN_USER + ':' + ADMIN_PASS, 'binary').toString('base64')}`;
const FETCH_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': AUTH_HEADER
};

const fetchOnDb = async (method, url, data) => {
  const response = await fetch(`${MEDIC_DB_URL}/${url}`, {
    method,
    headers: FETCH_HEADERS,
    body: data ? JSON.stringify(data) : null,
  });
  return response.json();
};

module.exports = {
  get: url => fetchOnDb('GET', url),
  post: (url, data) => fetchOnDb('POST', url, data),
};
