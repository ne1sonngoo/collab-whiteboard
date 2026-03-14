import { useParams } from "react-router-dom";
import Canvas from "./Canvas";

export default function Board() {
  const { id } = useParams();

  return (
    <div>
      <h2>Board: {id}</h2>
      <Canvas boardId={id} />
    </div>
  );
}