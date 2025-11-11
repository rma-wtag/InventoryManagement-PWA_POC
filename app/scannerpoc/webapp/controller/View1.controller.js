sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, JSONModel) => {
    "use strict";

    // Define the relative API URL
    const API_URL = "/odata/v4/catalog/Books"; 
    const CACHE_NAME = "fiori-pwa-cache-v1"; // make sure it matches your service worker

    return Controller.extend("scannerpoc.controller.View1", {
        onInit() {
            this.loadBooks();
        },

        /** 🔹 Load Books from CAP OData service */
        async loadBooks() {
            try {
                // 1️⃣ Try to read cached data first
                const cachedBooks = await caches.match(API_URL);
                if (cachedBooks) {
                    const data = await cachedBooks.json();
                    const oModel = new JSONModel(data);
                    this.getView().setModel(oModel);
                    console.log("✅ Books loaded from cache:", data);
                    return;
                }

                // 2️⃣ Fetch data from API if not cached
                const response = await fetch(API_URL);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                const oModel = new JSONModel(data);
                this.getView().setModel(oModel);

                // 3️⃣ Cache the fetched data for future use
                caches.open(CACHE_NAME).then((cache) => {
                    // Must clone response before putting it in cache
                    cache.put(API_URL, response.clone());
                });

                console.log("✅ Books loaded from API:", data);

            } catch (error) {
                console.error("❌ Failed to load books:", error);
                MessageToast.show("Failed to load book data.");
            }
        },

        /** 🔁 Reload books button handler */
        onReload() {
            this.loadBooks();
            MessageToast.show("Books reloaded!");
        },

        /** ✅ Barcode success handler */
        onScanSuccess(oEvent) {
            const sScannedCode = oEvent.getParameter("text");
            const sFormat = oEvent.getParameter("format");

            this.byId("sampleBarcodeScannerResult")
                .setText(`${sScannedCode} (${sFormat})`);

            MessageToast.show(`Scan successful: ${sScannedCode} [${sFormat}]`);
        },

        /** ❌ Barcode fail handler */
        onScanError(oEvent) {
            const sErrorMessage = oEvent.getParameter("message") || "Unknown error";
            this.byId("sampleBarcodeScannerResult").setText("Error: " + sErrorMessage);
            MessageToast.show("Scan failed: " + sErrorMessage);
        },

        /** 🔄 Live barcode update */
        onScanLiveupdate(oEvent) {
            const sLiveText = oEvent.getParameter("text") || "";
            if (sLiveText) {
                this.byId("sampleBarcodeScannerResult").setText("Scanning: " + sLiveText);
            }
        }
    });
});
