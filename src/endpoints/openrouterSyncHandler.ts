import type { PayloadHandler } from 'payload';
import { syncOpenRouterModels } from '../collections/models';

/**
 * Manual re-sync of the OpenRouter model registry.
 *
 * The init sync is best-effort and deliberately non-fatal, so there has to be a
 * way to run it again without restarting the app — after a network blip at
 * boot, or simply to pick up models released since.
 *
 * Authenticated users only: this triggers an outbound fetch and a bulk write
 * over the model registry, which is not something an anonymous caller should be
 * able to kick off.
 */
export const openrouterSyncHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const result = await syncOpenRouterModels(req.payload);

    req.payload.logger.info({
      msg: 'OpenRouter model sync run manually',
      user: req.user.id,
      ...result,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    req.payload.logger.error({ msg: 'Manual OpenRouter model sync failed', err: error });

    // The catalogue endpoint being unreachable is an expected failure, not a
    // server fault — report it as such so the admin UI can say so plainly.
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
};
