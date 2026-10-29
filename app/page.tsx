import AsadoApp from "./AsadoApp";
import { EVENT } from "@/lib/config";

export default function Home() {
  return <AsadoApp cfg={EVENT} />;
}
