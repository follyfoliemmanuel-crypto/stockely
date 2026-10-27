import "dotenv/config";
import { Client } from "pg";
import { hash } from "@node-rs/argon2";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error("TEST_DATABASE_URL is required");
}
if (connectionString === process.env.DATABASE_URL) {
  throw new Error("Refusing to run visual setup against the primary database");
}

const client = new Client({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: true },
});

const password = "VisualCheck2026!";
const email = "visual-check@example.test";

await client.connect();

try {
  const shops = await client.query(`
    select s.id, s.name, s.currency, s.timezone,
           (select count(*)::int from products p where p.shop_id = s.id) as products,
           (select count(*)::int from sales sa where sa.shop_id = s.id) as sales
    from shops s
    order by sales desc, products desc, s.created_at asc
    limit 10
  `);

  console.log("shops:");
  for (const shop of shops.rows) {
    console.log(
      `- ${shop.name} (${shop.id}) products=${shop.products} sales=${shop.sales} currency=${shop.currency} tz=${shop.timezone}`,
    );
  }

  const target = shops.rows.find((shop) => shop.sales > 0 && shop.products > 0) ?? shops.rows[0];
  if (!target) throw new Error("No shop found in TEST_DATABASE_URL");

  const existing = await client.query(
    `select id from users where lower(email) = lower($1) limit 1`,
    [email],
  );

  let userId;
  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await client.query(
      `update users set name = $2, password_hash = $3, email_verified_at = now(), updated_at = now() where id = $1`,
      [userId, "Visual Check", await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })],
    );
  } else {
    const inserted = await client.query(
      `insert into users (email, name, password_hash, email_verified_at)
       values ($1, $2, $3, now()) returning id`,
      [email, "Visual Check", await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })],
    );
    userId = inserted.rows[0].id;
  }

  await client.query(
    `insert into memberships (shop_id, user_id, role)
     values ($1, $2, 'owner')
     on conflict (shop_id, user_id) do update set role = 'owner', updated_at = now()`,
    [target.id, userId],
  );

  console.log(`visual user: ${email}`);
  console.log(`password: ${password}`);
  console.log(`shop: ${target.name} (${target.id})`);
} finally {
  await client.end();
}
