/**
 * ErrorBoundary.jsx
 * Catches render errors anywhere in the subtree and shows a friendly fallback
 * instead of a blank white screen.
 */
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={containerStyle}>
          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Something went wrong</h2>
            <p style={{ margin: "0 0 16px", color: "#666", fontSize: 14 }}>
              An unexpected error occurred. Try refreshing — your board state is saved on the server.
            </p>
            <pre style={preStyle}>{this.state.error.message}</pre>
            <button onClick={() => this.setState({ error: null })} style={btnStyle}>
              Try again
            </button>
            <button onClick={() => window.location.reload()} style={{ ...btnStyle, marginLeft: 8, background: "#eee", color: "#333" }}>
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const containerStyle = {
  display: "flex", alignItems: "center", justifyContent: "center",
  height: "100vh", background: "#f8f8f8",
};
const boxStyle = {
  background: "white", padding: "32px 40px", borderRadius: 12,
  boxShadow: "0 4px 24px rgba(0,0,0,0.1)", maxWidth: 480, width: "90%",
};
const preStyle = {
  background: "#fef2f2", color: "#b91c1c", padding: "12px 16px",
  borderRadius: 8, fontSize: 12, overflowX: "auto", marginBottom: 20,
};
const btnStyle = {
  padding: "8px 20px", borderRadius: 8, border: "none",
  background: "#3b82f6", color: "white", cursor: "pointer", fontSize: 14,
};