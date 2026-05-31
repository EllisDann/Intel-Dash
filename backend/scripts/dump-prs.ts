import { query } from '../src/db';

(async () => {
  try {
    console.log('Pull requests for ellisgitacc11/newrepo:');
    const rows = await query("SELECT id, repo_name, pr_number, title, state, metadata, created_at FROM pull_requests WHERE source_id = $1 ORDER BY created_at DESC", ['ellisgitacc11/newrepo']);
    console.log('rows:', rows.rowCount);
    for (const r of rows.rows) {
      console.log('---');
      console.log('id:', r.id);
      console.log('pr_number:', r.pr_number);
      console.log('title:', r.title);
      console.log('state:', r.state);
      console.log('created_at:', r.created_at);
      console.log('metadata:', r.metadata);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
