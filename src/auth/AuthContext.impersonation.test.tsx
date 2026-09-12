import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../api";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      startImpersonation: vi.fn(),
      stopImpersonation: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

function Probe() {
  const { user, impersonation } = useAuth();
  return (
    <div>
      <span>user:{user ? `${user.name}/${user.roles.join(",")}` : "none"}</span>
      <span>impersonating:{String(impersonation.active)}</span>
      {impersonation.realAdmin && <span>real:{impersonation.realAdmin.name}</span>}
    </div>
  );
}

function ImpersonateProbe() {
  const { startImpersonating, stopImpersonating } = useAuth();
  return (
    <>
      <button onClick={() => startImpersonating(42)}>act</button>
      <button onClick={() => stopImpersonating()}>return</button>
    </>
  );
}

const adminUser = { id: 1, name: "Admin", email_address: "admin@example.com", roles: ["admin"] };
const player = { id: 42, name: "Bea", email_address: "bea@example.com", roles: ["player"] };
const adminWithoutImpersonation = { ...adminUser };

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.me.mockResolvedValue(adminWithoutImpersonation);
});

describe("AuthContext impersonation", () => {
  it("starts impersonation: effective user becomes target, banner state active", async () => {
    const user = userEvent.setup();
    mockedApi.startImpersonation.mockResolvedValue({
      impersonating: true,
      effective_user: player,
      real_admin: adminUser,
    });
    render(
      <AuthProvider>
        <Probe />
        <ImpersonateProbe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("user:Admin/admin")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "act" }));
    await waitFor(() => {
      expect(screen.getByText("user:Bea/player")).toBeInTheDocument();
      expect(screen.getByText("impersonating:true")).toBeInTheDocument();
      expect(screen.getByText("real:Admin")).toBeInTheDocument();
    });
    expect(mockedApi.startImpersonation).toHaveBeenCalledWith(42);
  });

  it("stops impersonation and restores the admin", async () => {
    const user = userEvent.setup();
    mockedApi.startImpersonation.mockResolvedValue({
      impersonating: true,
      effective_user: player,
      real_admin: adminUser,
    });
    mockedApi.stopImpersonation.mockResolvedValue({
      impersonating: false,
      effective_user: null,
      real_admin: adminUser,
    });
    render(
      <AuthProvider>
        <Probe />
        <ImpersonateProbe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("user:Admin/admin")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "act" }));
    await waitFor(() => expect(screen.getByText("user:Bea/player")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "return" }));
    await waitFor(() => {
      expect(screen.getByText("user:Admin/admin")).toBeInTheDocument();
      expect(screen.getByText("impersonating:false")).toBeInTheDocument();
      expect(screen.queryByText("real:Admin")).not.toBeInTheDocument();
    });
    expect(mockedApi.stopImpersonation).toHaveBeenCalledOnce();
  });

  it("detects an active impersonation on session restore", async () => {
    mockedApi.me.mockResolvedValue({
      ...player,
      impersonating: true,
      real_admin: adminUser,
    } as unknown as typeof player);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("user:Bea/player")).toBeInTheDocument();
      expect(screen.getByText("impersonating:true")).toBeInTheDocument();
    });
  });

  it("clears impersonation on logout", async () => {
    const user = userEvent.setup();
    mockedApi.startImpersonation.mockResolvedValue({
      impersonating: true,
      effective_user: player,
      real_admin: adminUser,
    });
    mockedApi.logout.mockResolvedValue(undefined);
    render(
      <AuthProvider>
        <Probe />
        <ImpersonateProbe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("user:Admin/admin")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "act" }));
    await waitFor(() => expect(screen.getByText("impersonating:true")).toBeInTheDocument());

    function LogoutProbe() {
      const { logout } = useAuth();
      return <button onClick={() => logout()}>out</button>;
    }
    render(
      <AuthProvider>
        <Probe />
        <LogoutProbe />
      </AuthProvider>
    );
    await user.click(screen.getByRole("button", { name: "out" }));
    await waitFor(() => {
      expect(screen.getByText("impersonating:false")).toBeInTheDocument();
    });
  });
});
