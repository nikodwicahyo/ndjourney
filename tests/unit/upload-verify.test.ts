import { describe, it, expect, vi, beforeEach } from "vitest";

const resourceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cloudinary", () => ({
  cloudinary: { api: { resource: resourceMock } },
}));

process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";

const ME = "user-1";
const IMG_URL = `https://res.cloudinary.com/test-cloud/image/upload/v1/ndjourney-web/${ME}/a.jpg`;
const PUB_ID = `ndjourney-web/${ME}/a`;
const RAW_URL = `https://res.cloudinary.com/test-cloud/raw/upload/v1/ndjourney-web/${ME}/evil.html`;

async function load() {
  vi.resetModules();
  return await import("@/lib/upload-verify");
}

describe("upload-verify: delivery-path policy (no API call)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  });

  it("rejects raw delivery URLs without touching the Admin API", async () => {
    const { verifyUploadForSave } = await load();
    await expect(
      verifyUploadForSave({ url: RAW_URL, publicId: PUB_ID, userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 400 });
    expect(resourceMock).not.toHaveBeenCalled();
  });

  it("rejects foreign host / foreign publicId without API call", async () => {
    const { verifyUploadForSave } = await load();
    await expect(
      verifyUploadForSave({ url: "https://res.cloudinary.com/evil/image/upload/a.jpg", publicId: "evil/a", userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      verifyUploadForSave({ url: IMG_URL, publicId: "ndjourney-web/other/a", userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 400 });
    expect(resourceMock).not.toHaveBeenCalled();
  });

  it("rejects kind mismatch between URL and isVideo claim", async () => {
    const { verifyUploadForSave } = await load();
    await expect(
      verifyUploadForSave({ url: IMG_URL, publicId: PUB_ID, userId: ME, isVideo: true }),
    ).rejects.toMatchObject({ status: 400 });
    expect(resourceMock).not.toHaveBeenCalled();
  });

  it("deliveryKind matrix", async () => {
    const { verifyUploadForSave } = await load();
    void verifyUploadForSave;
    const policy = await import("@/lib/upload-policy");
    expect(policy.deliveryKind(IMG_URL)).toBe("image");
    expect(policy.deliveryKind("https://res.cloudinary.com/test-cloud/video/upload/a.mp4")).toBe("video");
    expect(policy.deliveryKind(RAW_URL)).toBeNull();
    expect(policy.isAllowedMediaDeliveryUrl(IMG_URL)).toBe(true);
    expect(policy.isAllowedMediaDeliveryUrl(RAW_URL)).toBe(false);
  });
});

describe("upload-verify: Admin API confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  });

  it("accepts a matching stored asset", async () => {
    resourceMock.mockResolvedValue({ resource_type: "image", format: "jpg", bytes: 8000 });
    const { verifyUploadForSave } = await load();
    const r = await verifyUploadForSave({ url: IMG_URL, publicId: PUB_ID, userId: ME, isVideo: false });
    expect(r).toMatchObject({ resourceType: "image", format: "jpg", bytes: 8000 });
  });

  it("rejects phantom rows (404 on image and video)", async () => {
    resourceMock.mockRejectedValue({ httpCode: 404 });
    const { verifyUploadForSave } = await load();
    await expect(
      verifyUploadForSave({ url: IMG_URL, publicId: PUB_ID, userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/tidak ditemukan/) });
    expect(resourceMock).toHaveBeenCalledTimes(2);
  });

  it("rejects disallowed detected format (e.g. svg-via-image)", async () => {
    resourceMock.mockResolvedValue({ resource_type: "image", format: "svg", bytes: 100 });
    const { verifyUploadForSave } = await load();
    await expect(
      verifyUploadForSave({ url: IMG_URL, publicId: PUB_ID, userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects detected-kind mismatch and oversize bytes", async () => {
    const { verifyUploadForSave } = await load();
    resourceMock.mockResolvedValue({ resource_type: "video", format: "mp4", bytes: 100 });
    await expect(
      verifyUploadForSave({ url: IMG_URL, publicId: PUB_ID, userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 400 });
    resourceMock.mockResolvedValue({ resource_type: "image", format: "png", bytes: 100 * 1024 * 1024 });
    await expect(
      verifyUploadForSave({ url: IMG_URL, publicId: PUB_ID, userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("maps Admin API transport failure to 503 (fail-closed, retryable)", async () => {
    resourceMock.mockRejectedValue(new Error("socket hang up"));
    const { verifyUploadForSave } = await load();
    await expect(
      verifyUploadForSave({ url: IMG_URL, publicId: PUB_ID, userId: ME, isVideo: false }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("accepts video assets against video claims", async () => {
    const videoUrl = `https://res.cloudinary.com/test-cloud/video/upload/v1/ndjourney-web/${ME}/a.mp4`;
    resourceMock.mockImplementation(async (_id: unknown, opts: { resource_type: string }) => {
      if (opts.resource_type === "image") throw { httpCode: 404 };
      return { resource_type: "video", format: "mp4", bytes: 9000 };
    });
    const { verifyUploadForSave } = await load();
    const r = await verifyUploadForSave({ url: videoUrl, publicId: PUB_ID, userId: ME, isVideo: true });
    expect(r).toMatchObject({ resourceType: "video", format: "mp4" });
  });
});
