import { NextResponse } from "next/server";
import {
  getApiKeyById,
  getApiKeyPolicy,
  setApiKeyPolicy,
  deleteApiKeyPolicy,
} from "@/lib/localDb";
import { isApiKeyPolicyEmpty, normalizeApiKeyPolicyInput } from "@/shared/utils/apiKeyPolicy";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const policy = await getApiKeyPolicy(id);
    return NextResponse.json({ policy });
  } catch (error) {
    console.log("Error fetching key policy:", error);
    return NextResponse.json({ error: "Failed to fetch key policy" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const body = await request.json();
    const normalized = normalizeApiKeyPolicyInput(body || {});

    if (isApiKeyPolicyEmpty(normalized)) {
      await deleteApiKeyPolicy(id);
      return NextResponse.json({ policy: null });
    }

    const policy = await setApiKeyPolicy(id, normalized);
    return NextResponse.json({ policy });
  } catch (error) {
    console.log("Error updating key policy:", error);
    const message = error?.message || "Failed to update key policy";
    const isInputError = message.toLowerCase().includes("invalid");
    return NextResponse.json({ error: message }, { status: isInputError ? 400 : 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await deleteApiKeyPolicy(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting key policy:", error);
    return NextResponse.json({ error: "Failed to delete key policy" }, { status: 500 });
  }
}
