import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { Loader } from "@/src/ui";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Redirect href="/auth" />;
  return <Redirect href="/(tabs)" />;
}
