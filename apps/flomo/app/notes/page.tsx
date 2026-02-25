import { redirect } from 'next/navigation';
import NotesApp from './ui';
import { getSessionUser } from '../../lib/auth';

export default async function NotesPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  return <NotesApp userEmail={user.email} userNickname={user.nickname} />;
}
