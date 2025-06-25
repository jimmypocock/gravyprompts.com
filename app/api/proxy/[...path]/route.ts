// Local development proxy to handle CORS issues with SAM Local
import { NextRequest, NextResponse } from "next/server";

const SAM_LOCAL_URL = process.env.SAM_LOCAL_URL || "http://localhost:7429";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Proxy not available in production" },
      { status: 404 },
    );
  }

  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const url = new URL(request.url);
  const targetUrl = `${SAM_LOCAL_URL}/${path}${url.search}`;

  console.log("[Proxy] GET request to:", targetUrl);
  
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: request.headers.get("Authorization") || "",
        "Content-Type": "application/json",
      },
    });

    // Handle non-JSON responses
    const getContentType = response.headers.get("content-type");
    if (!getContentType || !getContentType.includes("application/json")) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || "Non-JSON response from API" },
        {
          status: response.status,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        },
      );
    }

    // Check if response has JSON content
    const responseContentType = response.headers.get("content-type");
    let data;
    
    if (responseContentType && responseContentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        data = { error: "Invalid JSON response from API" };
      }
    } else {
      // If not JSON, return as error
      const text = await response.text();
      data = { error: text || `Non-JSON response with status ${response.status}` };
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("[Proxy] Error for URL:", targetUrl);
    console.error("[Proxy] Error details:", error);
    
    // Check if it's a connection error
    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { error: "Local API server not running. Please run: npm run dev:all" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 502 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Proxy not available in production" },
      { status: 404 },
    );
  }

  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const url = new URL(request.url);
  const targetUrl = `${SAM_LOCAL_URL}/${path}${url.search}`;
  const body = await request.text();

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: request.headers.get("Authorization") || "",
        "Content-Type": "application/json",
      },
      body: body,
    });

    // Check if response has JSON content
    const postContentType = response.headers.get("content-type");
    let data;
    
    if (postContentType && postContentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        data = { error: "Invalid JSON response from API" };
      }
    } else {
      // If not JSON, return as error
      const text = await response.text();
      data = { error: text || `Non-JSON response with status ${response.status}` };
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Proxy not available in production" },
      { status: 404 },
    );
  }

  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const url = new URL(request.url);
  const targetUrl = `${SAM_LOCAL_URL}/${path}${url.search}`;
  const body = await request.text();

  try {
    const response = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        Authorization: request.headers.get("Authorization") || "",
        "Content-Type": "application/json",
      },
      body: body,
    });

    // Check if response has JSON content
    const putContentType = response.headers.get("content-type");
    let data;
    
    if (putContentType && putContentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        data = { error: "Invalid JSON response from API" };
      }
    } else {
      // If not JSON, return as error
      const text = await response.text();
      data = { error: text || `Non-JSON response with status ${response.status}` };
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Proxy not available in production" },
      { status: 404 },
    );
  }

  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const url = new URL(request.url);
  const targetUrl = `${SAM_LOCAL_URL}/${path}${url.search}`;

  try {
    const response = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        Authorization: request.headers.get("Authorization") || "",
        "Content-Type": "application/json",
      },
    });

    // Check if response has JSON content
    const deleteContentType = response.headers.get("content-type");
    let data;
    
    if (deleteContentType && deleteContentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        data = { error: "Invalid JSON response from API" };
      }
    } else {
      // If not JSON, return as error
      const text = await response.text();
      data = { error: text || `Non-JSON response with status ${response.status}` };
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
