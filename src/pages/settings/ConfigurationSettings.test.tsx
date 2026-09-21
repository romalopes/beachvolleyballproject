import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api } from "../../api";
import ConfigurationSettings from "./ConfigurationSettings";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    api: {
      getConfiguration: vi.fn(),
      updateConfiguration: vi.fn(),
      appSettings: vi.fn(),
      createAppSetting: vi.fn(),
      updateAppSetting: vi.fn(),
      deleteAppSetting: vi.fn(),
    },
  };
});

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Admin", email_address: "a@b.c", roles: ["admin"] },
  }),
}));

const mockedApi = vi.mocked(api, true);

const config = {
  logs_saved_to_database: true,
  test: false,
  test_email: "romalopes@yahoo.com.br",
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ConfigurationSettings />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getConfiguration.mockResolvedValue({ ...config });
  mockedApi.appSettings.mockResolvedValue({ settings: [] });
  mockedApi.createAppSetting.mockResolvedValue({
    key: "maintenance_banner",
    value: "true",
    built_in: false,
  });
  mockedApi.updateConfiguration.mockResolvedValue({ ...config });
});

afterEach(cleanup);

describe("ConfigurationSettings page", () => {
  it("loads and displays the current configuration", async () => {
    renderPage();

    expect(await screen.findByText("Configuration")).toBeInTheDocument();
    expect(screen.getByLabelText(/save logs to database/i)).toBeChecked();
    expect(screen.getByLabelText(/redirect all emails/i)).not.toBeChecked();
    expect(screen.getByLabelText(/test email address/i)).toHaveValue(
      "romalopes@yahoo.com.br",
    );
  });

  it("saves changed settings", async () => {
    const user = userEvent.setup();
    mockedApi.updateConfiguration.mockResolvedValue({
      ...config,
      test: true,
    });
    renderPage();

    const testToggle = await screen.findByLabelText(/redirect all emails/i);
    await user.click(testToggle);
    expect(testToggle).toBeChecked();
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    expect(mockedApi.updateConfiguration).toHaveBeenCalledWith({
      logs_saved_to_database: true,
      test: true,
      test_email: "romalopes@yahoo.com.br",
    });
    expect(await screen.findByText(/saved at/i)).toBeInTheDocument();
  });

  it("disables save when nothing changed", async () => {
    renderPage();
    const save = await screen.findByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();
  });

  it("adds a new custom setting row", async () => {
    const user = userEvent.setup();
    renderPage();
    const keyInput = await screen.findByPlaceholderText(/maintenance_banner/i);
    await user.type(keyInput, "maintenance_banner");
    await user.type(screen.getByPlaceholderText("e.g. true"), "true");
    await user.click(screen.getByRole("button", { name: /add setting/i }));

    expect(mockedApi.createAppSetting).toHaveBeenCalledWith({
      key: "maintenance_banner",
      value: "true",
    });
    expect(await screen.findByText("maintenance_banner")).toBeInTheDocument();
  });

  it("lists custom settings and edits a value inline", async () => {
    const user = userEvent.setup();
    mockedApi.appSettings.mockResolvedValue({
      settings: [{ key: "custom_one", value: "old", built_in: false }],
    });
    mockedApi.updateAppSetting.mockResolvedValue({
      key: "custom_one",
      value: "new",
      built_in: false,
    });
    renderPage();

    expect(await screen.findByText("custom_one")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const input = screen.getByLabelText(/value for custom_one/i);
    await user.clear(input);
    await user.type(input, "new");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mockedApi.updateAppSetting).toHaveBeenCalledWith(
      "custom_one",
      "new",
    );
    expect(await screen.findByText("new")).toBeInTheDocument();
  });

  it("deletes a custom setting after confirmation", async () => {
    const user = userEvent.setup();
    mockedApi.appSettings.mockResolvedValue({
      settings: [{ key: "custom_one", value: "old", built_in: false }],
    });
    mockedApi.deleteAppSetting.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    expect(await screen.findByText("custom_one")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(mockedApi.deleteAppSetting).toHaveBeenCalledWith("custom_one");
    await screen.findByText(/no custom settings yet/i);
    confirmSpy.mockRestore();
  });
});
