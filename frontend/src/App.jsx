"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";


export default function DeployPage() {
  const [repoURL, setRepoURL] = useState("");
  const [projectName, setProjectName] = useState("");

  const [projectId, setProjectId] = useState(null);
  const [deploymentId, setDeploymentId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const logEndRef = useRef(null);

  const isValidURL = useMemo(() => {
    if (!repoURL.trim()) return false;
    const regex =
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/;
    return regex.test(repoURL);
  }, [repoURL]);

  useEffect(() => {
  if (!deploymentId) return;

  const interval = setInterval(async () => {
    try {
      const res = await axios.get(
        `http://localhost:9000/logs/${deploymentId}`
      );

      if (res.data && res.data.rawLogs) {
        const logsSorted = [...res.data.rawLogs].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        setLogs(logsSorted.map((l) => l.log));
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 5000);

  const stopTimeout = setTimeout(() => {
    clearInterval(interval);
  }, 120000);

  return () => {
    clearInterval(interval);
    clearTimeout(stopTimeout);
  };
}, [deploymentId]);

  const handleDeploy = useCallback(async () => {
    if (!projectName || !isValidURL) return;

    setLoading(true);
    setLogs([]);

    try {
      const projectRes = await axios.post("http://localhost:9000/project", {
        name: projectName,
        gitUrl: repoURL,
      });

      const pId = projectRes.data?.data?.project?.id;
      setProjectId(pId);

      const deployRes = await axios.post("http://localhost:9000/deploy", {
        projectId: pId,
      });

      const dId = deployRes.data?.data?.deployement;
      setDeploymentId(dId);
    } catch (err) {
      console.error("Deployment error:", err);
    } finally {
      setLoading(false);
    }
  }, [projectName, repoURL, isValidURL]);

  return (
    <main className="flex justify-center items-center min-h-screen bg-black text-white p-6">
      <div className="w-full max-w-xl">

        {/* Project Name */}
        <input
          type="text"
          placeholder="Project Name"
          disabled={loading}
          className="bg-gray-900 border border-gray-700 w-full p-2 rounded mb-3"
          onChange={(e) => setProjectName(e.target.value)}
        />

        {/* GitHub URL */}
        <input
          type="text"
          placeholder="GitHub Repo URL"
          disabled={loading}
          className="bg-gray-900 border border-gray-700 w-full p-2 rounded"
          value={repoURL}
          onChange={(e) => setRepoURL(e.target.value)}
        />

        <button
          onClick={handleDeploy}
          disabled={!isValidURL || !projectName || loading}
          className="w-full bg-blue-600 p-2 rounded mt-4 disabled:bg-gray-700"
        >
          {loading ? "Deploying..." : "Deploy"}
        </button>

        {/* Show deployment ID */}
        {deploymentId && (
          <div className="mt-4 p-3 bg-gray-900 rounded">
            <p className="text-green-400">
              Deployment ID: <b>{deploymentId}</b>
            </p>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-5 bg-gray-900 p-4 rounded border border-green-600 h-80 overflow-y-auto font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i}>{"> " + log}</div>
            ))}
            <div ref={logEndRef}></div>
          </div>
        )}
      </div>
    </main>
  );
}
