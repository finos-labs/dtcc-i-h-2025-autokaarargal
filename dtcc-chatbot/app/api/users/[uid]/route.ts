// app/api/users/[uid]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { UserData } from '@/types/user';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;

    if (!uid) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection<UserData>('users').findOne({ uid });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
      authProvider: user.authProvider,
    });
  } catch (error) {
    console.error('DB Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
