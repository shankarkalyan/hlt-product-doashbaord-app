import deployments from "../data/cmh-deployment-data.json";

// Round to one decimal place, matching the backend's behavior.
const round1 = (n) => Math.round(n * 10) / 10;

function buildTechnologyResponse() {
  const matrix = new Map();
  const apps = new Map();
  const techCounts = new Map();
  const techStatus = new Map();
  const techRepos = new Map();
  const statusCounts = new Map();
  const repoSet = new Set();
  const envSet = new Set();
  let latest = null;

  for (const d of deployments) {
    const appId = d.application_id;
    const tech = d.deploy_type;
    const status = d.deploy_status.toUpperCase();
    const matrixKey = `${appId}|${tech}`;
    const repoKey = `${appId}|${d.repo_name}`;

    matrix.set(matrixKey, (matrix.get(matrixKey) || 0) + 1);
    techCounts.set(tech, (techCounts.get(tech) || 0) + 1);

    if (!techStatus.has(tech)) techStatus.set(tech, new Map());
    const ts = techStatus.get(tech);
    ts.set(status, (ts.get(status) || 0) + 1);

    if (!techRepos.has(tech)) techRepos.set(tech, new Set());
    techRepos.get(tech).add(repoKey);

    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    repoSet.add(repoKey);
    envSet.add(d.environment.toUpperCase());

    if (!apps.has(appId)) {
      apps.set(appId, {
        application_id: appId,
        application_name: d.application_name,
        project_name: d.project_name,
      });
    }

    if (!latest || d.deploy_time > latest) latest = d.deploy_time;
  }

  const total = deployments.length;
  const success = statusCounts.get("SUCCESS") || 0;
  const ack = statusCounts.get("ACKNOWLEDGED") || 0;
  const failed = statusCounts.get("FAILED") || 0;

  const technologies = Array.from(techCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tech, count]) => {
      const s = techStatus.get(tech) || new Map();
      const tSucc = s.get("SUCCESS") || 0;
      const tAck = s.get("ACKNOWLEDGED") || 0;
      const tFail = s.get("FAILED") || 0;
      return {
        deploy_type: tech,
        count,
        percent: total ? round1((count / total) * 100) : 0,
        successful: tSucc,
        acknowledged: tAck,
        failed: tFail,
        success_rate: count ? round1((tSucc / count) * 100) : 0,
        repositories: techRepos.get(tech)?.size || 0,
      };
    });

  const applications = Array.from(apps.values()).sort((a, b) =>
    a.project_name.localeCompare(b.project_name)
  );

  const cells = Array.from(matrix.entries()).map(([key, count]) => {
    const sep = key.indexOf("|");
    return {
      application_id: Number(key.slice(0, sep)),
      deploy_type: key.slice(sep + 1),
      count,
    };
  });

  return {
    summary: {
      deployment_types: techCounts.size,
      total_repositories: repoSet.size,
      total_deployments: total,
      applications: apps.size,
      environments: envSet.size,
      success_rate: total ? round1((success / total) * 100) : 0,
      successful: success,
      acknowledged: ack,
      failed: failed,
      latest_deploy_time: latest,
    },
    total,
    technologies,
    applications,
    cells,
  };
}

function listDeployments({ deployType, applicationId } = {}) {
  let list = deployments;
  if (deployType) {
    const wanted = String(deployType).toUpperCase();
    list = list.filter((d) => d.deploy_type.toUpperCase() === wanted);
  }
  if (applicationId !== undefined && applicationId !== null) {
    const aid = Number(applicationId);
    list = list.filter((d) => d.application_id === aid);
  }
  const summary = list.map((d) => ({
    jet_uuid: d.jet_uuid,
    application_id: d.application_id,
    application_name: d.application_name,
    project_name: d.project_name,
    repo_name: d.repo_name,
    environment: d.environment,
    deploy_type: d.deploy_type,
    deploy_status: d.deploy_status,
    deploy_time: d.deploy_time,
    change_ctrl_ticket: d.change_ctrl_ticket,
  }));
  summary.sort((a, b) => (a.deploy_time < b.deploy_time ? 1 : -1));
  return {
    deploy_type: deployType ?? null,
    application_id: applicationId ?? null,
    count: summary.length,
    deployments: summary,
  };
}

function findDeployment(jetUuid) {
  return deployments.find((d) => d.jet_uuid === jetUuid) || null;
}

// Promise-returning facade so component code (which awaits these) keeps working
// unchanged. The data is local; resolution is synchronous-ish.
export const api = {
  technologies: () => Promise.resolve(buildTechnologyResponse()),
  deployments: (filter) => Promise.resolve(listDeployments(filter)),
  deployment: (jetUuid) => {
    const found = findDeployment(jetUuid);
    if (!found) {
      return Promise.reject(new Error(`Deployment ${jetUuid} not found`));
    }
    return Promise.resolve(found);
  },
};
