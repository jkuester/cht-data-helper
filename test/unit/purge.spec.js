const { expect } = require('chai');
const { purgeReportsAsOfDate, purgePatientsAsOfDate } = require('../../src/lib/purge');
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

  it('purges all patient contacts with default type as of a given date', async () => {
    const endDate = '2019-01-01';
    const endDateMillis = new Date(endDate).getTime();

    db.get.resolves({ rows: [
      { id: 'patient1' },
      { id: 'personNotPatient' },
      { id: 'recentPatient' },
      { id: 'patient2' }
    ] });
    tui.question.resolves('y');
    db.post.withArgs('/_bulk_get', sinon.match.any)
      .resolves({
        results: [
          { docs: [{ ok: { _id: 'patient1', _rev: 'rev1', role: 'patient', reported_date: endDateMillis } }] },
          { docs: [{ ok: { _id: 'personNotPatient', _rev: 'rev2', role: 'chw', reported_date: endDateMillis } }] },
          { docs: [{ ok: { _id: 'recentPatient', _rev: 'rev3', role: 'patient', reported_date: endDateMillis + 1 } }] },
          { docs: [{ ok: { _id: 'patient2', _rev: 'rev4', role: 'patient', reported_date: endDateMillis - 1 } }] },
        ]
      });

    await purgePatientsAsOfDate(endDate);

    expect(db.get.callCount).to.equal(1);
    expect(db.get.args[0][0])
      .to.equal(`_design/medic-client/_view/contacts_by_type?include_docs=false&key=["person"]`);

    expect(tui.question.callCount).to.equal(1);
    expect(tui.question.args[0][0]).to.equal(`Purging 2 patients. Continue? (y/N): `);
    expect(tui.log.callCount).to.equal(1);
    expect(tui.log.args[0][0]).to.equal(`Processing contacts 0 - 4...`);

    expect(db.post.callCount).to.equal(2);
    expect(db.post.args[0][0]).to.equal(`/_bulk_get`);
    expect(db.post.args[0][1]).to.deep.equal({ docs: [
      { id: 'patient1' },
      { id: 'personNotPatient' },
      { id: 'recentPatient' },
      { id: 'patient2' }
    ] });
    expect(db.post.args[1][0]).to.equal(`_purge`);
    expect(db.post.args[1][1]).to.deep.equal({ patient1: ['rev1'], patient2: ['rev4'] });
  });

  it('purges patient contacts with custom type', async () => {
    const endDate = '2019-01-01';
    const endDateMillis = new Date(endDate).getTime();

    db.get.resolves({ rows: [{ id: 'patient1' }] });
    tui.question.resolves('y');
    db.post.withArgs('/_bulk_get', sinon.match.any)
      .resolves({
        results: [
          { docs: [{ ok: { _id: 'patient1', _rev: 'rev1', role: 'patient', reported_date: endDateMillis } }] },
        ]
      });

    await purgePatientsAsOfDate(endDate, 'custom');

    expect(db.get.callCount).to.equal(1);
    expect(db.get.args[0][0])
      .to.equal(`_design/medic-client/_view/contacts_by_type?include_docs=false&key=["custom"]`);

    expect(tui.question.callCount).to.equal(1);
    expect(tui.question.args[0][0]).to.equal(`Purging 1 patients. Continue? (y/N): `);
    expect(tui.log.callCount).to.equal(1);
    expect(tui.log.args[0][0]).to.equal(`Processing contacts 0 - 1...`);

    expect(db.post.callCount).to.equal(2);
    expect(db.post.args[0][0]).to.equal(`/_bulk_get`);
    expect(db.post.args[0][1]).to.deep.equal({ docs: [
      { id: 'patient1' }
    ] });
    expect(db.post.args[1][0]).to.equal(`_purge`);
    expect(db.post.args[1][1]).to.deep.equal({ patient1: ['rev1'] });
  });
});
