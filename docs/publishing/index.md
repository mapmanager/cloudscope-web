# Publishing a CloudScope dataset

CloudScope Web is intended to connect an analyzed scientific result to the underlying imaging data and analysis.

When publishing a figure analyzed with CloudScope, authors can publish the corresponding **CloudScope analysis dataset, saved as OME-Zarr**, and provide a CloudScope Web link so readers can inspect the underlying images and analyses interactively.

## Proposed workflow

```text
Analyze data with CloudScope App
        ↓
Export the CloudScope analysis dataset as OME-Zarr
        ↓
Upload the OME-Zarr dataset to a suitable public archive or web host
        ↓
Open the published dataset in CloudScope Web
        ↓
Configure the image, channel, ROI, and analysis you want readers to see
        ↓
Copy and share the CloudScope Web URL
```

The same publication path can start from a custom Python script or notebook using [AcqStore](https://mapmanager.github.io/acqstore/):

```text
Analyze data with AcqStore in Python
        ↓
Export the CloudScope-compatible OME-Zarr dataset
        ↓
Publish the dataset
        ↓
Open and share it with CloudScope Web
```

## Where to publish the dataset

The OME-Zarr dataset needs a stable web-accessible location that can serve the individual files and objects required by a browser-based Zarr viewer.

For long-term scientific sharing, a public scientific archive is preferable when an appropriate archive supports the dataset and its current submission requirements. The [DANDI Archive](https://about.dandiarchive.org/) is one archive to consider for relevant neuroscience datasets; check its current format and submission guidance before choosing it for a particular dataset.

Other institutional repositories, object-storage services, or web hosts can also be appropriate depending on the publication and preservation requirements of the project.

## Create the reader-facing link

After the dataset is available at its final URL:

1. Open CloudScope Web.
2. Open the published dataset URL.
3. Select the image and analysis relevant to the figure or result.
4. Copy the resulting CloudScope Web URL.
5. Include that URL wherever readers or collaborators should be able to open the interactive view.

A stable dataset URL is important because the CloudScope Web sharing URL refers back to the published dataset.
