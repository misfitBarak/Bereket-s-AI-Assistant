import { NextRequest, NextResponse } from "next/server";
import {
  getPersonalAccountStatus,
  startPersonalLogin,
  completePersonalLogin,
  disconnectPersonalAccount,
  getPersonalContacts,
  getPersonalConversationMessages,
  setContactAlias,
  getPersonalCredentials,
} from "@/lib/telegram/personalClient";

export async function GET() {
  try {
    const [status, creds] = await Promise.all([
      getPersonalAccountStatus(),
      getPersonalCredentials(),
    ]);

    return NextResponse.json({
      success: true,
      status,
      aliases: creds.contactAliases,
      hasApiCredentials: Boolean(creds.apiId && creds.apiHash),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start_login": {
        const { phoneNumber, apiId, apiHash } = body;
        const res = await startPersonalLogin({
          phoneNumber,
          apiId: apiId ? parseInt(apiId, 10) : undefined,
          apiHash,
        });
        return NextResponse.json(res);
      }

      case "complete_login": {
        const { code, password, phoneCodeHash, phoneNumber } = body;
        const res = await completePersonalLogin({
          code,
          password,
          phoneCodeHash,
          phoneNumber,
        });
        return NextResponse.json(res);
      }

      case "disconnect": {
        const res = await disconnectPersonalAccount();
        return NextResponse.json(res);
      }

      case "set_alias": {
        const { alias, contactName } = body;
        if (!alias || !contactName) {
          return NextResponse.json(
            { success: false, error: "Alias and contactName are required" },
            { status: 400 }
          );
        }
        const res = await setContactAlias(alias, contactName);
        return NextResponse.json(res);
      }

      case "get_contacts": {
        const contacts = await getPersonalContacts();
        return NextResponse.json({ success: true, contacts });
      }

      case "get_messages": {
        const { peer, limit } = body;
        if (!peer) {
          return NextResponse.json({ success: false, error: "Peer is required" }, { status: 400 });
        }
        const messages = await getPersonalConversationMessages(peer, limit || 10);
        return NextResponse.json({ success: true, messages });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
