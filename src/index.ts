import { defineEndpoint } from "@directus/extensions-sdk";
import { DriverS3 } from "@directus/storage-driver-s3";
import contentDisposition from "content-disposition";

const MINUTE = 60000;

export default {
  id: "s3",
  handler: defineEndpoint((router, context) => {
    const { services, getSchema, env, logger } = context;
    const { FilesService } = services;

    let client = getClient(env);

    setTimeout(() => {
      client = getClient(env);
      logger.info("S3 Client Refreshed");
    }, 5 * MINUTE);

    router.get("/:pk", async (req, res) => {
      debugger;

      const filesService = new FilesService({
        schema: await getSchema(),
        accountability: req.accountability,
      });

      const file = await filesService.readOne(req.params.pk, {
        limit: 1,
      });

      if (!file?.id) {
        res.status(404);
        return res.end();
      }

      const stat = await client.stat(file.filename_disk);

      if (req.method.toLowerCase() === "head") {
        res.status(200);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Length", stat.size);

        return res.end();
      }

      const version =
        file.modified_on !== undefined
          ? String(Math.round(new Date(file.modified_on).getTime() / 1000))
          : undefined;

      const stream = await client.read(file.filename_disk, { version });

      res.attachment(file.filename_download);
      res.setHeader("Content-Type", file.type);
      res.setHeader("Accept-Ranges", "bytes");

      if ("download" in req.query === false) {
        res.setHeader(
          "Content-Disposition",
          contentDisposition(file.filename_disk, { type: "inline" })
        );
      }

      stream
        .on("error", (error) => {
          logger.error(error, `Couldn't stream file ${file.id} to the client`);

          if (!res.headersSent) {
            res.removeHeader("Content-Type");
            res.removeHeader("Content-Disposition");
            res.removeHeader("Cache-Control");

            res.status(500).json({
              errors: [
                {
                  message: "An unexpected error occurred.",
                  extensions: {
                    code: "INTERNAL_SERVER_ERROR",
                  },
                },
              ],
            });
          } else {
            res.end();
          }
        })
        .pipe(res);
    });
  }),
};

function getClient(env) {
  return new DriverS3({
    bucket: env["STORAGE_CLOUD_BUCKET"],
    root: env["STORAGE_CLOUD_ROOT"],
    region: env["STORAGE_CLOUD_REGION"],
  });
}
