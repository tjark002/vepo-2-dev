import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const STAGED_UPLOADS_CREATE = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_CREATE = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        alt
        createdAt
        ... on MediaImage {
          image {
            url
          }
          preview {
            image {
              url
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_QUERY = `
  query getFile($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image {
          url
          width
          height
        }
        preview {
          image {
            url
          }
        }
      }
    }
  }
`;

const FILES_QUERY = `
  query getFiles($first: Int!, $after: String, $query: String) {
    files(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        cursor
        node {
          ... on MediaImage {
            id
            alt
            createdAt
            fileStatus
            image {
              url
              width
              height
            }
            preview {
              image {
                url
              }
            }
          }
          ... on GenericFile {
            id
            alt
            createdAt
            url
            mimeType
            preview {
              image {
                url
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name;
    const mimeType = file.type || "image/png";

    const stagedRes = await admin.graphql(STAGED_UPLOADS_CREATE, {
      variables: {
        input: [
          {
            filename,
            mimeType,
            resource: "FILE",
            httpMethod: "POST",
          },
        ],
      },
    });

    const stagedData = await stagedRes.json();
    const target = stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];
    const userErrors = stagedData.data?.stagedUploadsCreate?.userErrors;

    if (userErrors?.length > 0) {
      return json({ error: userErrors[0].message }, { status: 400 });
    }

    if (!target) {
      return json({ error: "Failed to create staged upload" }, { status: 500 });
    }

    const uploadForm = new FormData();
    for (const param of target.parameters) {
      uploadForm.append(param.name, param.value);
    }
    uploadForm.append("file", file);

    const uploadRes = await fetch(target.url, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      return json({ error: "Failed to upload file to Shopify CDN" }, { status: 500 });
    }

    const createRes = await admin.graphql(FILE_CREATE, {
      variables: {
        files: [
          {
            alt: filename.replace(/\.[^.]+$/, ""),
            contentType: "IMAGE",
            originalSource: target.resourceUrl,
          },
        ],
      },
    });

    const createData = await createRes.json();
    const createErrors = createData.data?.fileCreate?.userErrors;

    if (createErrors?.length > 0) {
      return json({ error: createErrors[0].message }, { status: 400 });
    }

    const createdFile = createData.data?.fileCreate?.files?.[0];
    if (!createdFile) {
      return json({ error: "File creation returned no file" }, { status: 500 });
    }

    let finalUrl = createdFile.image?.url || createdFile.preview?.image?.url;
    const fileId = createdFile.id;

    if (!finalUrl && fileId) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const pollRes = await admin.graphql(FILE_QUERY, {
          variables: { id: fileId },
        });
        const pollData = await pollRes.json();
        const node = pollData.data?.node;
        if (node?.fileStatus === "READY" && node?.image?.url) {
          finalUrl = node.image.url;
          break;
        }
        if (node?.fileStatus === "FAILED") {
          return json({ error: "File processing failed" }, { status: 500 });
        }
      }
    }

    if (!finalUrl) {
      return json({ error: "Timed out waiting for file processing" }, { status: 500 });
    }

    return json({
      url: finalUrl,
      alt: filename.replace(/\.[^.]+$/, ""),
      id: fileId,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return json({ error: "Upload failed" }, { status: 500 });
  }
};

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const after = url.searchParams.get("after") || null;
  const search = url.searchParams.get("search") || "";
  const first = parseInt(url.searchParams.get("first") || "24");

  let query = "media_type:IMAGE";
  if (search) {
    query += ` AND filename:*${search}*`;
  }

  try {
    const response = await admin.graphql(FILES_QUERY, {
      variables: {
        first,
        after,
        query,
      },
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      return json({ error: "Fehler beim Laden der Dateien", files: [], pageInfo: null }, { status: 500 });
    }

    const files = data.data.files.edges
      .map(({ node, cursor }) => {
        if (node.image) {
          return {
            id: node.id,
            url: node.image.url,
            thumbnailUrl: node.preview?.image?.url || node.image.url,
            alt: node.alt || "",
            width: node.image.width,
            height: node.image.height,
            cursor,
          };
        }
        if (node.url && node.mimeType?.startsWith("image/")) {
          return {
            id: node.id,
            url: node.url,
            thumbnailUrl: node.preview?.image?.url || node.url,
            alt: node.alt || "",
            cursor,
          };
        }
        return null;
      })
      .filter(Boolean);

    return json({
      files,
      pageInfo: data.data.files.pageInfo,
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    return json({ error: "Fehler beim Laden der Dateien", files: [], pageInfo: null }, { status: 500 });
  }
};
