import { parentExchange, ApiError, json } from "../../../lib/server";
export const dynamic = "force-dynamic";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    return await parentExchange(r, (await params).token);
  } catch (e) {
    return json(
      {
        error:
          e instanceof ApiError
            ? e.message
            : "Le lien est momentanément indisponible.",
      },
      e instanceof ApiError ? e.status : 503,
    );
  }
}
