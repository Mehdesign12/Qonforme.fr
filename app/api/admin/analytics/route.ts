import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-require";

export const dynamic = "force-dynamic";

const PH_HOST = "https://us.i.posthog.com";

async function phQuery(query: string) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) throw new Error("POSTHOG_PERSONAL_API_KEY missing");

  const res = await fetch(`${PH_HOST}/api/projects/@current/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.results ?? [];
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "POSTHOG_PERSONAL_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const [
      visitorsToday,
      visitors7d,
      visitors30d,
      topPages,
      topReferrers,
      signupFunnel,
      dailyVisitors,
    ] = await Promise.all([
      // Visiteurs uniques aujourd'hui
      phQuery(`
        SELECT count(DISTINCT distinct_id)
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= today()
      `),

      // Visiteurs uniques 7 derniers jours
      phQuery(`
        SELECT count(DISTINCT distinct_id)
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= now() - interval 7 day
      `),

      // Visiteurs uniques 30 derniers jours
      phQuery(`
        SELECT count(DISTINCT distinct_id)
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= now() - interval 30 day
      `),

      // Top 10 pages (30 jours)
      phQuery(`
        SELECT
          properties.$pathname AS path,
          count() AS views,
          count(DISTINCT distinct_id) AS uniques
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= now() - interval 30 day
        GROUP BY path
        ORDER BY views DESC
        LIMIT 10
      `),

      // Top referrers (30 jours)
      phQuery(`
        SELECT
          properties.$referrer AS referrer,
          count(DISTINCT distinct_id) AS uniques
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= now() - interval 30 day
          AND properties.$referrer IS NOT NULL
          AND properties.$referrer != ''
        GROUP BY referrer
        ORDER BY uniques DESC
        LIMIT 8
      `),

      // Funnel : landing → signup page → inscription
      phQuery(`
        SELECT
          count(DISTINCT CASE WHEN path = '/' THEN distinct_id END) AS landing,
          count(DISTINCT CASE WHEN path = '/signup' THEN distinct_id END) AS signup_page,
          count(DISTINCT CASE WHEN path = '/dashboard' THEN distinct_id END) AS completed
        FROM (
          SELECT distinct_id, properties.$pathname AS path
          FROM events
          WHERE event = '$pageview'
            AND timestamp >= now() - interval 30 day
        )
      `),

      // Visiteurs par jour (14 derniers jours)
      phQuery(`
        SELECT
          toDate(timestamp) AS day,
          count(DISTINCT distinct_id) AS uniques,
          count() AS pageviews
        FROM events
        WHERE event = '$pageview'
          AND timestamp >= now() - interval 14 day
        GROUP BY day
        ORDER BY day ASC
      `),
    ]);

    return NextResponse.json({
      visitors: {
        today: visitorsToday[0]?.[0] ?? 0,
        week: visitors7d[0]?.[0] ?? 0,
        month: visitors30d[0]?.[0] ?? 0,
      },
      topPages: topPages.map((r: string[]) => ({
        path: r[0],
        views: r[1],
        uniques: r[2],
      })),
      topReferrers: topReferrers.map((r: string[]) => ({
        referrer: r[0],
        uniques: r[1],
      })),
      funnel: {
        landing: signupFunnel[0]?.[0] ?? 0,
        signupPage: signupFunnel[0]?.[1] ?? 0,
        completed: signupFunnel[0]?.[2] ?? 0,
      },
      dailyVisitors: dailyVisitors.map((r: string[]) => ({
        day: r[0],
        uniques: r[1],
        pageviews: r[2],
      })),
    });
  } catch (e) {
    console.error("PostHog analytics error:", e);
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
