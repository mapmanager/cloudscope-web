# Using CloudScope Web

This page covers the main workflow for viewing a CloudScope analysis dataset.

## 1. Open CloudScope Web

Open:

**https://mapmanager.github.io/cloudscope-web/**

CloudScope Web is a static website. There is nothing to install or start on your computer for normal viewing.

## 2. Open a dataset

Use **Open collection** in the CloudScope Web header.

You can choose one of the provided samples, paste the root URL of a published dataset and choose **Open URL**, or open a current AcqStore OME-Zarr directory from your computer.

To open local data in Chrome or Edge:

1. Choose **Open local directory**.
2. Select the root directory whose name ends with `.ome.zarr`.
3. Approve read-only access when the browser asks.

The local directory stays on your computer. CloudScope Web reads its manifests, tables, and required Zarr chunks directly through the browser. Local directory access is not currently supported in Safari or Firefox, and a local collection cannot be restored from a shared URL after the page is reloaded.

CloudScope Web accepts only the current `acqstore-acq-image-collection` export format. Re-export older AcqStore OME-Zarr collections rather than opening their legacy layouts.

After the dataset loads, CloudScope Web displays the collection and its available images.

## 3. Choose an image

The collection table provides an overview of the images in the dataset. Select a row to open that image.

The table can include information such as image dimensions, channel count, ROI count, available analyses, acquisition information, and whether a reference image is available.

## 4. Work with the image viewer

Use the image viewer to inspect the selected image. The controls available depend on the image, but can include:

- pan and zoom
- channel selection
- multi-channel display
- contrast and LUT controls
- ROI overlays and ROI selection

!!! tip "Familiar controls for CloudScope users"
The image viewer in CloudScope Web uses the same viewer code as the desktop [CloudScope](https://mapmanager.github.io/cloudscope-app/), so its core image interaction and display controls should feel familiar to existing CloudScope users.

## 5. Select a channel and ROI

For multi-channel data, choose the channel you want to view. If the image contains ROIs, select the ROI associated with the analysis you want to view.

CloudScope Web uses the selected channel and ROI to show the analyses that apply to that part of the dataset.

## 6. View analysis results

Analysis plots appear for analyses exported with the selected image, channel, and ROI.

The current viewer includes registered plots for:

- Diameter
- Summed intensity
- Radon velocity

A dataset does not need to contain every analysis type. CloudScope Web shows the results that were exported with that dataset.

Open **NicePool** to explore a collection-level analysis table. When the
collection supplies a default NicePool workspace, it is applied automatically.
Selecting a NicePool point or row opens its corresponding image, channel, and
ROI. Selecting an image in the collection table updates the NicePool selection.

## 7. Inspect metadata

Use the left toolbar to inspect information associated with the selected image and experiment. CloudScope Web provides inspectors for the collection file list, reference image, image-header metadata, experiment metadata, and app information.

The **Reference image** inspector uses an image viewer independent from the primary image viewer. Its **Scan Path** checkbox shows or hides the exported, display-only scan line. When the selected AcqImage has no reference image, the inspector reports that explicitly.

These views are useful when you need more context about how an image was acquired or how it fits into the larger dataset.

## 8. Share what you are viewing

Once you have selected the dataset, image, channel, and ROI you want to discuss, copy the URL from the browser address bar and send it to a coleague.

See [Sharing a view](sharing.md) for the recommended sharing workflow and details about what the current URL restores.
