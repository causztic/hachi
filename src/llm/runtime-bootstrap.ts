import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { ensureDir } from "../util/fs";

const execFileAsync = promisify(execFile);
const acceptedManifestMediaTypes = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json"
].join(", ");

type RegistryTokenResponse = {
  access_token?: string;
  token?: string;
};

type OciPlatform = {
  architecture?: string;
  os?: string;
};

type OciDescriptor = {
  digest?: string;
  mediaType?: string;
  platform?: OciPlatform;
};

type OciImageIndex = {
  manifests?: OciDescriptor[];
  mediaType?: string;
};

type OciImageManifest = {
  layers?: OciDescriptor[];
  mediaType?: string;
};

class RegistryRequestError extends Error {
  constructor(
    readonly status: number,
    readonly url: string
  ) {
    super(`registry request failed: ${status} ${url}`);
  }
}

export type OfficialLlamaRuntimeSource = {
  platform: {
    architecture: string;
    os: string;
  };
  registry: string;
  repository: string;
  tag: string;
};

export type OfficialLlamaRuntimeConfig = {
  rootfsDir: string;
  serverBinaryRelativePath: string;
  source: OfficialLlamaRuntimeSource;
  tmpDir: string;
};

type RuntimeBootstrapDependencies = {
  ensureDirImpl?: typeof ensureDir;
  extractLayer?: (
    archivePath: string,
    mediaType: string,
    targetDir: string
  ) => Promise<void>;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  mkdirImpl?: typeof mkdir;
  mkdtempImpl?: typeof mkdtemp;
  rmImpl?: typeof rm;
  statImpl?: typeof stat;
  writeFileImpl?: typeof writeFile;
};

function getRegistryService(registry: string): string {
  return new URL(registry).host;
}

function getLayerArchiveExtension(mediaType: string): string {
  if (mediaType.includes("zstd")) {
    return ".tar.zst";
  }

  if (mediaType.includes("gzip")) {
    return ".tar.gz";
  }

  return ".tar";
}

async function extractLayerArchive(
  archivePath: string,
  mediaType: string,
  targetDir: string
): Promise<void> {
  const args = ["--extract", "--file", archivePath, "--directory", targetDir, "--no-same-owner"];

  if (mediaType.includes("zstd")) {
    args.splice(1, 0, "--zstd");
  } else if (mediaType.includes("gzip")) {
    args.splice(1, 0, "--gzip");
  }

  await ensureDir(targetDir);
  await execFileAsync("tar", args);
}

async function fetchRegistryJson(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const response =
    Object.keys(headers).length === 0
      ? await fetchImpl(url)
      : await fetchImpl(url, {
          headers
        });

  if (!response.ok) {
    throw new RegistryRequestError(response.status, url);
  }

  return await response.json();
}

function isImageManifest(
  manifest: OciImageIndex | OciImageManifest
): manifest is OciImageManifest {
  return Array.isArray((manifest as OciImageManifest).layers);
}

async function resolveRuntimeManifest(input: {
  fetchImpl: typeof fetch;
  source: OfficialLlamaRuntimeSource;
  token: string;
}): Promise<OciImageManifest> {
  const registryHeaders = {
    accept: acceptedManifestMediaTypes,
    authorization: `Bearer ${input.token}`
  };
  const manifestUrl = `${input.source.registry}/v2/${input.source.repository}/manifests/${input.source.tag}`;
  let initialManifest: OciImageIndex | OciImageManifest;

  try {
    initialManifest = await fetchRegistryJson(
      manifestUrl,
      registryHeaders,
      input.fetchImpl
    ) as OciImageIndex | OciImageManifest;
  } catch (error) {
    if (error instanceof RegistryRequestError && error.status === 404) {
      throw new Error(
        `official llama runtime tag was not found: ${input.source.registry}/${input.source.repository}:${input.source.tag}`
      );
    }

    throw error;
  }

  if (isImageManifest(initialManifest)) {
    return initialManifest;
  }

  const platformManifest = initialManifest.manifests?.find(
    (manifest) =>
      manifest.platform?.architecture === input.source.platform.architecture &&
      manifest.platform?.os === input.source.platform.os
  );

  if (!platformManifest?.digest) {
    throw new Error(
      `no official llama runtime for ${input.source.platform.os}/${input.source.platform.architecture} in ${input.source.registry}/${input.source.repository}:${input.source.tag}`
    );
  }

  const resolvedManifest = await fetchRegistryJson(
    `${input.source.registry}/v2/${input.source.repository}/manifests/${platformManifest.digest}`,
    registryHeaders,
    input.fetchImpl
  ) as OciImageIndex | OciImageManifest;

  if (!isImageManifest(resolvedManifest)) {
    throw new Error(
      `registry returned an unexpected manifest for ${platformManifest.digest}`
    );
  }

  return resolvedManifest;
}

export async function ensureOfficialLlamaRuntime(
  config: OfficialLlamaRuntimeConfig,
  dependencies: RuntimeBootstrapDependencies = {}
): Promise<void> {
  const binaryPath = join(config.rootfsDir, config.serverBinaryRelativePath);
  const ensureDirImpl = dependencies.ensureDirImpl ?? ensureDir;
  const extractLayer = dependencies.extractLayer ?? extractLayerArchive;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const log = dependencies.log ?? (() => undefined);
  const mkdirImpl = dependencies.mkdirImpl ?? mkdir;
  const mkdtempImpl = dependencies.mkdtempImpl ?? mkdtemp;
  const rmImpl = dependencies.rmImpl ?? rm;
  const statImpl = dependencies.statImpl ?? stat;
  const writeFileImpl = dependencies.writeFileImpl ?? writeFile;

  try {
    await statImpl(binaryPath);
    return;
  } catch {
    // Bootstrap continues below when the binary is missing.
  }

  log(
    `bootstrapping official llama runtime from ${config.source.registry}/${config.source.repository}:${config.source.tag}`
  );

  const service = getRegistryService(config.source.registry);
  const tokenPayload = (await fetchRegistryJson(
    `${config.source.registry}/token?service=${service}&scope=repository:${config.source.repository}:pull`,
    {},
    fetchImpl
  )) as RegistryTokenResponse;
  const token = tokenPayload.token ?? tokenPayload.access_token;

  if (!token) {
    throw new Error(
      `registry token response did not include a bearer token for ${config.source.registry}/${config.source.repository}`
    );
  }

  const manifest = await resolveRuntimeManifest({
    fetchImpl,
    source: config.source,
    token
  });

  await ensureDirImpl(config.tmpDir);
  const bootstrapDir = await mkdtempImpl(
    join(config.tmpDir, "llama-runtime-bootstrap-")
  );

  try {
    await rmImpl(config.rootfsDir, {
      force: true,
      recursive: true
    });
    await mkdirImpl(config.rootfsDir, {
      recursive: true
    });

    for (const [index, layer] of (manifest.layers ?? []).entries()) {
      if (!layer.digest) {
        throw new Error(
          `official llama runtime manifest is missing a digest for layer ${index}`
        );
      }

      const mediaType = layer.mediaType ?? "application/vnd.oci.image.layer.v1.tar";
      log(`extracting runtime layer ${index + 1}/${manifest.layers?.length ?? 0}`);
      const layerResponse = await fetchImpl(
        `${config.source.registry}/v2/${config.source.repository}/blobs/${layer.digest}`,
        {
          headers: {
            authorization: `Bearer ${token}`
          }
        }
      );

      if (!layerResponse.ok) {
        throw new Error(
          `runtime layer download failed: ${layerResponse.status} ${layer.digest}`
        );
      }

      const archivePath = join(
        bootstrapDir,
        `layer-${index}${getLayerArchiveExtension(mediaType)}`
      );
      const archiveBuffer = Buffer.from(await layerResponse.arrayBuffer());

      await writeFileImpl(archivePath, archiveBuffer);
      await extractLayer(archivePath, mediaType, config.rootfsDir);
    }

    try {
      await statImpl(binaryPath);
      log(`official llama runtime ready at ${binaryPath}`);
    } catch {
      throw new Error(
        `failed to bootstrap official llama runtime: missing ${config.serverBinaryRelativePath} from ${config.source.registry}/${config.source.repository}:${config.source.tag}`
      );
    }
  } finally {
    await rmImpl(bootstrapDir, {
      force: true,
      recursive: true
    });
  }
}
