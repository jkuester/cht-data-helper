const { expect } = require('chai');
const { purgeReportsAsOfDate } = require('../../src/lib/purge');
const sinon = require('sinon');
const tui = require('../../src/lib/tui');
const db = require('../../src/lib/db');

describe('purge', () => {
  beforeEach(() => {
    sinon.stub(tui, 'log');
    sinon.stub(tui, 'question');
    sinon.stub(db, 'get');
    sinon.stub(db, 'post');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('purges all reports as of the given date', async () => {
    const endDate = '2019-01-01';
    const endDateMillis = new Date(endDate).getTime();

    db.get.resolves({ rows: [{ id: 'report1' }, { id: 'report2' }] });
    tui.question.resolves('y');
    db.post.withArgs('/_bulk_get', sinon.match.any)
      .resolves({
        results: [
          { docs: [{ ok: { _id: 'report1', _rev: 'rev1' } }] },
          { docs: [{ ok: { _id: 'report2', _rev: 'rev2' } }] }
        ]
      });

    await purgeReportsAsOfDate(endDate);

    expect(db.get.callCount).to.equal(1);
    expect(db.get.args[0][0])
      .to.equal(`_design/medic-client/_view/reports_by_date?include_docs=false&endkey=[${endDateMillis}]`);

    expect(tui.question.callCount).to.equal(1);
    expect(tui.question.args[0][0]).to.equal(`Purging 2 reports. Continue? (y/N): `);
    expect(tui.log.callCount).to.equal(1);
    expect(tui.log.args[0][0]).to.equal(`Purging reports 0 - 2...`);

    expect(db.post.callCount).to.equal(2);
    expect(db.post.args[0][0]).to.equal(`/_bulk_get`);
    expect(db.post.args[0][1]).to.deep.equal({ docs: [{ id: 'report1' }, { id: 'report2' }] });
    expect(db.post.args[1][0]).to.equal(`_purge`);
    expect(db.post.args[1][1]).to.deep.equal({ report1: ['rev1'], report2: ['rev2'] });
  });
});
