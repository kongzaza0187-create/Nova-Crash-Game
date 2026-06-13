/**
 * SKY RUSH — LOAD & STRESS TESTING CONFIGURATION
 * Infrastructure Orchestration & Akamai Performance Profile
 * Target: 1,000,000 Concurrent Players
 */

export interface LoadBalancerConfig {
  algorithm: "round-robin" | "least-connections" | "ip-hash";
  minimumServerNodes: number;
  maximumServerNodes: number;
  autoScaling: {
    scaleUpCpuPercentageTrigger: number;
    scaleDownCpuPercentageTrigger: number;
    cooldownPeriodSeconds: number;
  };
  healthCheck: {
    endpoint: string;
    intervalMs: number;
    healthyThreshold: number;
    unhealthyThreshold: number;
    expectedResponse: {
      status: string;
      metricsRequired: string[];
    };
  };
}

export interface StressScenario {
  id: string;
  name: string;
  concurrentUsers: number;
  targetRequestsPerSecond: number;
  durationMinutes: number;
  rampUpTimeSeconds: number;
}

export interface PerformanceTargets {
  latencyNormalPercentile95Ms: number;
  latencyPeakPercentile99Ms: number;
  maximumErrorRatePercent: number;
  systemUptimeTargetPercent: number;
}

export interface DeploymentStrategyBlueGreen {
  strategy: "Blue-Green";
  steps: {
    stepIndex: number;
    action: string;
    verificationMethod?: string;
    rollbackDurationMinutes: number;
  }[];
  rollbackProcess: {
    hotStandbyDurationMinutes: number;
    trafficSwitchLatencySeconds: number;
  };
}

// ==========================================
// INFRASTRUCTURE DEFINITION EXPORTS
// ==========================================

export const AkamaiLoadBalancerSetup: LoadBalancerConfig = {
  algorithm: "round-robin",
  minimumServerNodes: 3,
  maximumServerNodes: 50, // Capacity limit under super-stress 1M peak
  autoScaling: {
    scaleUpCpuPercentageTrigger: 70,   // Add node when CPU average exceeds 70%
    scaleDownCpuPercentageTrigger: 30, // Drop node when CPU average drops below 30%
    cooldownPeriodSeconds: 180,
  },
  healthCheck: {
    endpoint: "/health",
    intervalMs: 5000,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    expectedResponse: {
      status: "ok",
      metricsRequired: ["status", "uptime", "memory", "cpu"],
    },
  },
};

export const StressTestScenarios: StressScenario[] = [
  {
    id: "scenario_1_normal",
    name: "Scenario 1 - Normal Client Wave Coverage",
    concurrentUsers: 10000,
    targetRequestsPerSecond: 100,
    durationMinutes: 10,
    rampUpTimeSeconds: 60,
  },
  {
    id: "scenario_2_peak",
    name: "Scenario 2 - Peak Traffic Spikes (Flash Event)",
    concurrentUsers: 100000,
    targetRequestsPerSecond: 1000,
    durationMinutes: 5,
    rampUpTimeSeconds: 30,
  },
  {
    id: "scenario_3_stress",
    name: "Scenario 3 - Super Scale Shock Stress Test",
    concurrentUsers: 1000000,
    targetRequestsPerSecond: 10000,
    durationMinutes: 2,
    rampUpTimeSeconds: 15,
  },
];

export const SystemPerformanceMetricsTargets: PerformanceTargets = {
  latencyNormalPercentile95Ms: 200, // Under 200ms latency for 95% of users in normal load
  latencyPeakPercentile99Ms: 500,   // Under 500ms latency for 99% of users during spikes
  maximumErrorRatePercent: 0.1,    // Less than 0.1% failed wagers/connections overall
  systemUptimeTargetPercent: 99.99, // 99.99% active SLA guarantee
};

export const BlueGreenDeploymentGuide: DeploymentStrategyBlueGreen = {
  strategy: "Blue-Green",
  steps: [
    {
      stepIndex: 1,
      action: "Spin up next release binaries inside the dedicated isolated 'Green' context environment.",
      rollbackDurationMinutes: 0,
    },
    {
      stepIndex: 2,
      action: "Run automated local cluster integrations and synthetic health scans against the Green context.",
      verificationMethod: "Akamai CLI synthetic endpoints test suite verifying matching build signatures.",
      rollbackDurationMinutes: 0,
    },
    {
      stepIndex: 3,
      action: "Warm-up cache clusters and database connection pools inside the Green architecture.",
      rollbackDurationMinutes: 0,
    },
    {
      stepIndex: 4,
      action: "Transition proxy configurations at the CDN / Gateway level, rerouting live edge traffic cleanly from Blue to Green.",
      verificationMethod: "Real-time edge telemetry monitoring during progressive DNS weight balancing.",
      rollbackDurationMinutes: 5,
    },
    {
      stepIndex: 5,
      action: "Operate the legacy 'Blue' production nodes on full hot standby configuration for 30 minutes.",
      rollbackDurationMinutes: 30,
    },
    {
      stepIndex: 6,
      action: "Decommission and scale down the obsolete 'Blue' host nodes upon verified system stabilization.",
      rollbackDurationMinutes: 0,
    },
  ],
  rollbackProcess: {
    hotStandbyDurationMinutes: 30,
    trafficSwitchLatencySeconds: 0, // Instant gateway switch back to hot-standby Blue environment with 0 seconds downtime
  },
};
