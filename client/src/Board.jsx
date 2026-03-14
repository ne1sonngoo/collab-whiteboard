import { useParams } from "react-router-dom";
import Canvas from "./components/Canvas";

export default function Board() {
  const { boardId } = useParams();

  return <Canvas boardId={boardId} />;
}