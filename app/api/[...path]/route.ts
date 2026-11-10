import { handle, ApiError, json } from "../../../lib/server";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
async function route(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    return await handle(request, (await params).path);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error("Orbite API", e);
    return json(
      {
        error:
          "Le serveur n’a pas pu terminer cette action. Votre saisie est conservée. Réessayez.",
      },
      500,
    );
  }
}
export { route as GET, route as POST, route as PUT, route as DELETE };
