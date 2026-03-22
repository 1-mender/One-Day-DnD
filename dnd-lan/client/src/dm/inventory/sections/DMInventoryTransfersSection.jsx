import { RefreshCcw } from "lucide-react";
import Skeleton from "../../../components/ui/Skeleton.jsx";
import { FilterBar, SectionCard } from "../../../foundation/primitives/index.js";
import { t } from "../../../i18n/index.js";

export default function DMInventoryTransfersSection({
  cancelTransfer,
  filteredTransfers,
  loadTransfers,
  readOnly,
  transferQ,
  setTransferQ,
  transfers,
  transfersLoading
}) {
  return (
    <SectionCard
      className="u-mt-12 tf-panel dm-inv-transfers-card"
      title={t("dmInventory.transfersTitle")}
      subtitle={t("dmInventory.transfersHint")}
      actions={(
        <button className="btn secondary" onClick={loadTransfers}>
          <RefreshCcw className="icon" aria-hidden="true" />{t("dmInventory.refresh")}
        </button>
      )}
    >
      <FilterBar>
        <input
          value={transferQ}
          onChange={(event) => setTransferQ(event.target.value)}
          placeholder={t("dmInventory.transferSearch")}
          aria-label={t("dmInventory.transferSearch")}
          className="u-w-full"
        />
      </FilterBar>
      <div className="u-mt-8">
        {transfersLoading ? (
          <Skeleton h={80} w="100%" />
        ) : filteredTransfers.length === 0 ? (
          <div className="small">
            {transfers.length ? t("dmInventory.transferNotFound") : t("dmInventory.transferEmpty")}
          </div>
        ) : (
          <div className="list dm-inv-transfer-list">
            {filteredTransfers.map((transfer) => (
              <div key={transfer.id} className="item u-items-start dm-inv-transfer-item">
                <div className="u-flex-1">
                  <div className="row u-row-gap-8 u-row-wrap">
                    {Number(transfer.expiresAt || 0) > 0 && Number(transfer.expiresAt) <= Date.now() ? (
                      <span className="badge secondary">{t("dmInventory.transferExpiredBadge")}</span>
                    ) : null}
                    <span className="badge secondary">{t("dmInventory.transferFrom", { value: transfer.fromName || `#${transfer.fromPlayerId}` })}</span>
                    <span className="badge secondary">{t("dmInventory.transferTo", { value: transfer.toName || `#${transfer.toPlayerId}` })}</span>
                    <span className="badge">{t("dmInventory.transferQty", { value: transfer.qty })}</span>
                    <span className="small">{new Date(transfer.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="small u-mt-6">
                    {t("dmInventory.transferItem", { value: transfer.itemName || `#${transfer.itemId}` })}
                  </div>
                  {transfer.note ? (
                    <div className="small u-mt-6">
                      <b>{t("dmInventory.transferNoteLabel")}</b> {transfer.note}
                    </div>
                  ) : null}
                </div>
                <div className="row u-row-gap-8 u-row-wrap">
                  <button className="btn danger" onClick={() => cancelTransfer(transfer)} disabled={readOnly}>
                    {t("dmInventory.transferCancel")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
