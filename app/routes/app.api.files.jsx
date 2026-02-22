import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

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
