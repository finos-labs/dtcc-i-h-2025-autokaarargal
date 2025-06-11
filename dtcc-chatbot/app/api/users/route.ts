// app/api/users/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { UserData } from '@/types/user';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db('perplexity');

    const userData: Partial<UserData> = await request.json();

    if (!userData.uid || !userData.email) {
      return NextResponse.json(
        { error: "Missing required fields: uid or email" },
        { status: 400 }
      );
    }

    const updateData: Partial<UserData> = {
      email: userData.email,
      updatedAt: new Date(),
      authProvider: userData.authProvider || ['email'],
    };

    if (userData.displayName) updateData.displayName = userData.displayName;
    if (userData.photoURL) updateData.photoURL = userData.photoURL;
    if (userData.passwordHash) updateData.passwordHash = userData.passwordHash;
    if (userData.googleId) updateData.googleId = userData.googleId;

    const result = await db.collection<UserData>('users').updateOne(
      { uid: userData.uid },
      {
        $set: updateData,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      uid: userData.uid,
      isNewUser: !!result.upsertedId,
    }, { status: 200 });

  } catch (error) {
    console.error("DB Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
