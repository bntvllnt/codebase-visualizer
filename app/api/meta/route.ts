import { NextResponse } from "next/server";
import { getProjectName } from "@/src/server/graph-store";

export function GET(): NextResponse {
  return NextResponse.json({ projectName: getProjectName() });
}
